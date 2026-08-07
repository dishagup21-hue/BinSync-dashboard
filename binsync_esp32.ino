/* ============================================================
   BinSync ESP32 firmware  (cloud version)

   Difference from your old sketch: the ESP32 no longer hosts its
   own WiFi page. It now JOINS your WiFi, POSTs one fill reading up
   to Supabase, then deep-sleeps to save battery. The public
   dashboard reads from Supabase, so it works from anywhere.

   Board:  ESP32 (Arduino core)
   Wiring: HC-SR04  TRIG -> GPIO5,  ECHO -> GPIO18 (via divider to 3.3V)
   ============================================================ */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ---------------- CONFIG: edit these ----------------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// From Supabase -> Project Settings -> API
const char* SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const char* SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY";   // the "anon public" key

const char* BIN_ID       = "bin_01";   // must match a row in the bins table
const float BIN_DEPTH_CM = 30.0;       // empty-bin distance from sensor to floor

const uint64_t SLEEP_MINUTES = 15;     // how often to wake and report
// ----------------------------------------------------

#define TRIG 5
#define ECHO 18

float readDistanceCM() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long dur = pulseIn(ECHO, HIGH, 30000);   // 30 ms timeout
  if (dur == 0) return -1;
  return dur * 0.0343 / 2.0;
}

// Median of several reads to reject HC-SR04 noise/dropouts.
float medianDistanceCM(int samples) {
  float vals[15];
  int n = 0;
  if (samples > 15) samples = 15;
  for (int i = 0; i < samples; i++) {
    float d = readDistanceCM();
    if (d > 0 && d < 400) vals[n++] = d;
    delay(60);
  }
  if (n == 0) return -1;
  for (int i = 1; i < n; i++) {         // insertion sort
    float key = vals[i]; int j = i - 1;
    while (j >= 0 && vals[j] > key) { vals[j + 1] = vals[j]; j--; }
    vals[j + 1] = key;
  }
  return vals[n / 2];
}

const char* levelFor(float pct) {
  if (pct < 0) return "ERR";
  if (pct >= 85) return "FULL";
  if (pct >= 60) return "MEDIUM";
  return "LOW";
}

bool postReading(float dist, float pct, const char* level) {
  WiFiClientSecure client;
  client.setInsecure();   // skip TLS cert check — simplest for this use

  HTTPClient https;
  String url = String(SUPABASE_URL) + "/rest/v1/readings";
  if (!https.begin(client, url)) {
    Serial.println("begin() failed");
    return false;
  }
  https.addHeader("apikey", SUPABASE_KEY);
  https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  https.addHeader("Content-Type", "application/json");
  https.addHeader("Prefer", "return=minimal");

  char body[192];
  if (pct < 0) {
    snprintf(body, sizeof(body),
      "{\"bin_id\":\"%s\",\"dist_cm\":null,\"pct\":null,\"level\":\"ERR\"}",
      BIN_ID);
  } else {
    snprintf(body, sizeof(body),
      "{\"bin_id\":\"%s\",\"dist_cm\":%.1f,\"pct\":%.0f,\"level\":\"%s\"}",
      BIN_ID, dist, pct, level);
  }

  int code = https.POST((uint8_t*)body, strlen(body));
  Serial.printf("POST -> HTTP %d\n", code);
  if (code < 200 || code >= 300) {
    Serial.println(https.getString());
  }
  https.end();
  return code >= 200 && code < 300;
}

void deepSleep() {
  esp_sleep_enable_timer_wakeup(SLEEP_MINUTES * 60ULL * 1000000ULL);
  Serial.printf("Sleeping %llu min...\n", SLEEP_MINUTES);
  Serial.flush();
  esp_deep_sleep_start();
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP: "); Serial.println(WiFi.localIP());
    float dist = medianDistanceCM(7);
    float pct  = (dist < 0) ? -1
                 : constrain((BIN_DEPTH_CM - dist) / BIN_DEPTH_CM * 100.0, 0, 100);
    Serial.printf("dist=%.1f cm  pct=%.0f  level=%s\n",
                  dist, pct, levelFor(pct));
    postReading(dist, pct, levelFor(pct));
  } else {
    Serial.println("WiFi failed — skipping this cycle");
  }

  deepSleep();   // loop() never runs; chip resets into setup() on wake
}

void loop() {}
