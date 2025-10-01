import { classifyEmotionGesture, withSafeDefaults } from "./classifier.js";

const samples = [
	"That’s a great idea! Let’s try it.",
	"Two steps: first install dependencies, second run the server.",
	"I’m not sure; do you mean local or production?",
	"Sorry, I can't do that right now.",
	"No, that's incorrect.",
	"Click the button to continue.",
];

for (const s of samples) {
	const res = withSafeDefaults(classifyEmotionGesture(s));
	console.log(JSON.stringify({ text: s, ...res }));
}





