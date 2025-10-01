// Simple, fast, deterministic classifier for facial expression, gesture, intensity, and tempo
// Derived from reply text (and optionally user input in the future)

function clamp01(value) {
	if (Number.isNaN(value)) return 0;
	if (value < 0) return 0;
	if (value > 1) return 1;
	return value;
}

function normalizeWhitespace(text) {
	return (text || "").toString().trim();
}

// Heuristic-based mapping per spec
export function classifyEmotionGesture(text) {
	const reply = normalizeWhitespace(text);
	if (!reply) {
		return {
			facialExpression: "neutral",
			gesture: "idle",
			intensity: 0.3,
			tempo: 0.5,
		};
	}

	const lower = reply.toLowerCase();
	const hasExclaim = reply.includes("!");
	const exclaimCount = (reply.match(/!/g) || []).length;
	const hasQuestion = reply.includes("?");

	const positiveWords = ["great", "awesome", "love", "excellent", "fantastic", "nice", "glad", "cool", "amazing"];
	const apologyWords = ["sorry", "apologies", "unfortunately", "can’t", "cant", "cannot"];
	const negativeWords = ["no ", " don’t", " dont", "not correct", "incorrect", "wrong", "hate"];

	const pointWords = ["click", "look", "see", "this", "that", "here", "there"];
	const countWords = ["first", "second", "third", "1.", "2.", "3."];
	const thinkingPhrases = ["i think", "let’s consider", "lets consider", "i guess", "i wonder"];

	const containsAny = (arr) => arr.some((w) => lower.includes(w));

	// Base defaults
	let facialExpression = "neutral";
	let gesture = "idle";
	let intensity = 0.45;
	let tempo = 0.5;

	// Intent-specific overrides
	if (containsAny(pointWords)) {
		gesture = "point";
	}
	if (containsAny(countWords)) {
		gesture = "count";
	}
	if (containsAny(thinkingPhrases)) {
		facialExpression = "thinking";
		gesture = gesture === "idle" ? "explain" : gesture;
		intensity = 0.45;
		tempo = 0.55;
	}

	// Sentiment / tone
	if (containsAny(positiveWords) || hasExclaim) {
		facialExpression = "smile";
		if (gesture === "idle") gesture = "delight";
		intensity = 0.65;
		tempo = 0.55;
	}
	if (hasQuestion) {
		// distinguish surprised vs thinking
		if (lower.includes("what?!") || lower.includes("no way") || (hasExclaim && hasQuestion)) {
			facialExpression = "surprised";
			gesture = gesture === "idle" ? "explain" : gesture;
			intensity = 0.6;
			tempo = 0.6;
		} else {
			facialExpression = facialExpression === "smile" ? "smile" : "thinking";
			gesture = gesture === "idle" ? "explain" : gesture;
			intensity = Math.max(intensity, 0.45);
			tempo = Math.max(tempo, 0.55);
		}
	}
	if (containsAny(apologyWords)) {
		facialExpression = "sad";
		gesture = "shrug";
		intensity = 0.35 + (hasExclaim ? 0.1 : 0);
		tempo = 0.45;
	}
	if (containsAny(negativeWords)) {
		facialExpression = lower.includes("incorrect") || lower.includes("wrong") ? "angry" : "angry";
		gesture = "disagree";
		intensity = 0.6;
		tempo = 0.6;
	}

	// Modulators
	intensity += Math.min(exclaimCount * 0.05, 0.2);
	if (hasQuestion) tempo += 0.05;

	// Length modulation: longer → slightly slower
	const numChars = reply.length;
	const lengthPenalty = Math.min(numChars / 500, 0.15); // up to -0.15 for very long replies
	tempo = tempo - lengthPenalty;

	// Clamping
	intensity = clamp01(intensity);
	tempo = clamp01(tempo);

	return { facialExpression, gesture, intensity, tempo };
}

// Provide safe defaults helper
export function withSafeDefaults(result) {
	const defaults = {
		facialExpression: "neutral",
		gesture: "idle",
		intensity: 0.45,
		tempo: 0.5,
	};
	try {
		return {
			facialExpression: result?.facialExpression || defaults.facialExpression,
			gesture: result?.gesture || defaults.gesture,
			intensity: clamp01(Number(result?.intensity ?? defaults.intensity)),
			tempo: clamp01(Number(result?.tempo ?? defaults.tempo)),
		};
	} catch (_) {
		return defaults;
	}
}

export default classifyEmotionGesture;





