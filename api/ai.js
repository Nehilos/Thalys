const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const FREE_TIER_ONLY = process.env.THALYS_AI_FREE_ONLY !== "false";
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "530515970912-7mlo4stsbcbcajrov07f911se4upv8t2.apps.googleusercontent.com";

function send(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function validateGoogleUser(req) {
  const accessToken = req.headers["x-google-access-token"];
  const idToken = req.headers["x-google-id-token"];

  if (accessToken && typeof accessToken === "string") {
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!tokenInfoRes.ok) throw new Error("AUTH_INVALID");
    const tokenInfo = await tokenInfoRes.json();

    const tokenAudience =
      tokenInfo.aud || tokenInfo.issued_to || tokenInfo.azp || tokenInfo.client_id || null;
    if (tokenAudience && tokenAudience !== GOOGLE_CLIENT_ID)
      throw new Error("AUTH_INVALID_AUDIENCE");

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) throw new Error("AUTH_INVALID");
    const profile = await profileRes.json();

    return {
      sub: profile.sub || tokenInfo.sub || null,
      email: profile.email || tokenInfo.email || null,
    };
  }

  if (idToken && typeof idToken === "string") {
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!r.ok) throw new Error("AUTH_INVALID");
    const info = await r.json();
    if (info.aud !== GOOGLE_CLIENT_ID) throw new Error("AUTH_INVALID_AUDIENCE");
    return { sub: info.sub, email: info.email || null };
  }

  throw new Error("AUTH_REQUIRED");
}

async function openFoodFactsSearch(foodName) {
  try {
    const url =
      "https://world.openfoodfacts.org/cgi/search.pl?" +
      new URLSearchParams({
        search_terms: foodName,
        search_simple: "1",
        action: "process",
        json: "1",
        page_size: "3",
      });
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Thalys-Wellness/1.0 (nutrition lookup)",
        Accept: "application/json",
      },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.products || []).slice(0, 3).map((p) => ({
      product_name: p.product_name || null,
      brands: p.brands || null,
      serving_size: p.serving_size || null,
      nutriments: p.nutriments || {},
    }));
  } catch {
    return null;
  }
}

function commonSystem(locale) {
  return `You are the analysis engine embedded in a personal wellness app called Thalys.
Reply in locale ${locale || "it-IT"}.
Use only the data supplied in the request. Do not invent measurements, diagnoses, diseases, allergies, medications or medical history.
Recommendations must be general wellness, nutrition and training guidance, not medical diagnosis or treatment.
When evidence is missing, explicitly say that the available data is insufficient.
Prefer trends and repeated patterns over one isolated value.
Do not shame the user and do not frame rest days as failures.
Output valid JSON only.`;
}

function promptForAction(body, offData) {
  const goal = body.goal || "Benessere generale";
  const specific = body.specificRequest || "";
  const snapshot = JSON.stringify(body.snapshot || null);
  const workoutPlan = JSON.stringify(body.workoutPlan || null);

  if (body.action === "nutrition_consult") {
    return `Analyze the nutrition snapshot below for the goal "${goal}".
User-specific request: ${specific || "none"}.

SNAPSHOT:
${snapshot}

Return this JSON shape:
{
  "summary": "concise description of current eating pattern",
  "positives": ["what appears consistent or adequate"],
  "priorities": ["specific improvements, highest priority first"],
  "sevenDayPlan": ["one practical action for each of 7 days"],
  "notes": ["limits of the available data"]
}

Compare calories, protein, carbohydrates, fats, saturated fat, sugars, fiber, water and all available micronutrients—including calcium, magnesium, zinc, iron and potassium—with the targets inside the snapshot.
Call out nutrients that are repeatedly low or high, not single-day noise.
For each useful correction, suggest common food sources where appropriate.
Do not prescribe supplements or therapeutic diets.`;
  }

  if (body.action === "workout_consult") {
    const preferences = JSON.stringify(body.workoutPreferences || null, null, 2);
    return `Analyze the user's physical/training snapshot and training preferences.
Goal: "${goal}".
User-specific request: ${specific || "none"}.

SNAPSHOT:
${snapshot}

TRAINING PREFERENCES:
${preferences}

CURRENT PLAN (optional):
${workoutPlan || "none"}

Return:
{
  "summary": "overall assessment",
  "positives": ["what is working"],
  "priorities": ["what could be improved and why"],
  "sevenDayPlan": ["practical next-week guidance"],
  "notes": ["data limitations and recovery considerations"]
}

Evaluate frequency, exercise distribution, training volume, load progression, completion consistency and available wellness/recovery data.
Keep useful parts of the existing plan instead of changing things only for novelty.
Do not diagnose injury or medical conditions.`;
  }

  if (body.action === "full_consult") {
    return `Analyze the complete Thalys snapshot for the goal "${goal}".
User-specific request: ${specific || "none"}.

SNAPSHOT:
${snapshot}

Return:
{
  "summary": "integrated picture of body trends, nutrition, training, recovery and mind practice",
  "positives": ["strong patterns"],
  "priorities": ["the 3-5 highest leverage improvements"],
  "sevenDayPlan": ["one realistic action for each of the next 7 days"],
  "notes": ["uncertainties or missing data"]
}

Look for interactions between nutrition, recovery, body trends and training rather than analyzing each area in isolation.
Avoid diagnosis or treatment claims.`;
  }

  if (body.action === "workout_plan") {
    const preferences = JSON.stringify(body.workoutPreferences || null, null, 2);
    return `Create an improved Thalys workout plan based on the snapshot, user preferences, optional current plan and previous AI advice.
Goal: "${goal}".

SNAPSHOT:
${snapshot}

TRAINING PREFERENCES:
${preferences}

CURRENT PLAN (optional):
${workoutPlan || "none"}

PREVIOUS ADVICE:
${JSON.stringify(body.previousAdvice || null)}

Return exactly:
{
  "workoutPlan": {
    "name": "short plan name",
    "restDays": ["Martedì", "Domenica"],
    "exercises": [
      {
        "name": "exercise name",
        "dayOfWeek": "Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica",
        "category": "Petto|Dorso|Gambe|Spalle|Braccia|Bicipite|Tricipite|Quadricipiti|Femorali|Glutei|Polpaccio|Core|Cardio|Altro",
        "rpe": 8,
        "weight": 0,
        "series": 3,
        "reps": 8,
        "recovery": 90
      }
    ]
  },
  "rationale": ["brief reasons for major changes"]
}

IMPORTANT:
- dayOfWeek and restDays MUST use the canonical Italian weekday values shown above because this is the import schema, even if the user interface is another language.
- Use restDays for explicitly programmed rest days.
- Preserve exercises or structure that already fit the goal.
- Use weight 0 when the supplied data does not justify a specific load.
- Every exercise MUST include "series" as an integer >= 1. Never omit it, even when adapting an older plan.
- The plan must be importable by Thalys V8. Exercise schema is exactly: name, dayOfWeek, category, series, reps, weight, rpe, recovery.`;
  }

  if (body.action === "food_lookup") {
    return `Find/normalize average nutritional values per 100 g for the food "${body.foodName || ""}".
Open Food Facts candidates, if available:
${JSON.stringify(offData || null)}

Return exactly:
{
  "name": "normalized food name",
  "kcal": number|null,
  "p": number|null,
  "c": number|null,
  "f": number|null,
  "satFat": number|null,
  "sugars": number|null,
  "fiber": number|null,
  "calcium": number|null,
  "magnesium": number|null,
  "zinc": number|null,
  "iron": number|null,
  "potassium": number|null,
  "salt": number|null,
  "vitaminsId": "space-separated B1 B2 B3 B5 B6 B7 B9 B12 C codes or empty string",
  "vitaminsLip": "space-separated A D E K codes or empty string",
  "source": "Open Food Facts | Open Food Facts + AI completion | AI estimate",
  "confidence": "high|medium|low",
  "notes": "brief caveat if values vary"
}

Units:
- kcal in kcal/100 g
- protein/carbs/fat/saturated fat/sugars/fiber/salt in g/100 g
- calcium/magnesium/zinc/iron/potassium in mg/100 g

Prefer Open Food Facts values when a candidate clearly matches the requested food.
Use general food-composition knowledge only to fill missing values, and use null when not reasonably supportable.
Do not fabricate vitamin presence with high confidence.`;
  }

  throw new Error("UNKNOWN_ACTION");
}

async function callGemini(systemText, userText) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY_MISSING");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      DEFAULT_MODEL
    )}:generateContent?key=${encodeURIComponent(key)}`;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  const raw = await r.text();
  if (!r.ok) {
    let detail = raw;
    try {
      detail = JSON.parse(raw)?.error?.message || raw;
    } catch {}
    if (r.status === 429 && FREE_TIER_ONLY) throw new Error("AI_FREE_TIER_LIMIT");
    throw new Error(`GEMINI_${r.status}: ${detail.slice(0, 500)}`);
  }

  const json = JSON.parse(raw);
  const output =
    json?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!output) throw new Error("EMPTY_AI_RESPONSE");

  try {
    return JSON.parse(output);
  } catch {
    const stripped = output
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(stripped);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });

  try {
    await validateGoogleUser(req);

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const allowed = new Set([
      "nutrition_consult",
      "workout_consult",
      "full_consult",
      "workout_plan",
      "food_lookup",
    ]);
    if (!allowed.has(body.action)) return send(res, 400, { ok: false, error: "UNKNOWN_ACTION" });

    const serializedSize = JSON.stringify(body).length;
    if (serializedSize > 350000)
      return send(res, 413, { ok: false, error: "REQUEST_TOO_LARGE" });

    if (body.action !== "food_lookup" && !body.snapshot)
      return send(res, 400, { ok: false, error: "SNAPSHOT_REQUIRED" });
    if (body.action === "food_lookup" && !String(body.foodName || "").trim())
      return send(res, 400, { ok: false, error: "FOOD_NAME_REQUIRED" });

    const offData =
      body.action === "food_lookup" ? await openFoodFactsSearch(String(body.foodName).trim()) : null;

    const result = await callGemini(
      commonSystem(body.locale),
      promptForAction(body, offData)
    );

    return send(res, 200, {
      ok: true,
      model: DEFAULT_MODEL,
      data: result,
      source: body.action === "food_lookup" ? "Open Food Facts + Gemini" : "Gemini",
      costMode: FREE_TIER_ONLY ? "free-tier-only" : "configured",
    });
  } catch (err) {
    console.error("Thalys AI error:", err);
    const msg = String(err?.message || err || "AI_ERROR");
    const status = msg.startsWith("AUTH_") ? 401 : msg === "GEMINI_API_KEY_MISSING" ? 503 : 500;
    return send(res, status, { ok: false, error: msg.slice(0, 700) });
  }
}
