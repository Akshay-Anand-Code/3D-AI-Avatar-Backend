import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import voice from "elevenlabs-node";
import express from "express";
import { promises as fs } from "fs";
import OpenAI from "openai";
import { classifyEmotionGesture, withSafeDefaults } from "./classifier.js";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "-", // Your OpenAI API key here, I used "-" to avoid errors when the key is not set but you should not do that
});

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceID = "21m00Tcm4TlvDq8ikWAM";
//21m00Tcm4TlvDq8ikWAM

const app = express();
app.use(express.json());

// CORS configuration
app.use(cors({
  origin: [
    'https://3d-avatar-zeta.vercel.app',
    'http://localhost:5173',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
const port = process.env.PORT || 3000;

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  res.send(await voice.getVoices(elevenLabsApiKey));
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (message) => {
  const time = new Date().getTime();
  console.log(`Starting conversion for message ${message}`);
  await execCommand(
    `ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`
    // -y to overwrite the file
  );
  console.log(`Conversion done in ${new Date().getTime() - time}ms`);
  await execCommand(
    `./bin/rhubarb -f json -o audios/message_${message}.json audios/message_${message}.wav -r phonetic`
  );
  // -r phonetic is faster but less accurate
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
};

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    res.send({
      messages: [
        {
          text: "Hey dear... How was your day?",
          audio: await audioFileToBase64("audios/intro_0.wav"),
          lipsync: await readJsonTranscript("audios/intro_0.json"),
          facialExpression: "smile",
          gesture: "delight",
          intensity: 0.6,
          tempo: 0.55,
          animation: "Talking_1",
        },
        {
          text: "I missed you so much... Please don't go for so long!",
          audio: await audioFileToBase64("audios/intro_1.wav"),
          lipsync: await readJsonTranscript("audios/intro_1.json"),
          facialExpression: "sad",
          gesture: "shrug",
          intensity: 0.5,
          tempo: 0.5,
          animation: "Crying",
        },
      ],
    });
    return;
  }
  if (!elevenLabsApiKey || openai.apiKey === "-") {
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          gesture: "disagree",
          intensity: 0.6,
          tempo: 0.55,
          animation: "Angry",
        },
        {
          text: "You don't want to ruin Wawa Sensei with a crazy ChatGPT and ElevenLabs bill, right?",
          audio: await audioFileToBase64("audios/api_1.wav"),
          lipsync: await readJsonTranscript("audios/api_1.json"),
          facialExpression: "smile",
          gesture: "delight",
          intensity: 0.6,
          tempo: 0.55,
          animation: "Laughing",
        },
      ],
    });
    return;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    max_tokens: 1000,
    temperature: 0.6,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: `
        You are a virtual girlfriend.
        You will always reply with a JSON array of messages. With a maximum of 3 messages.
        Each message has a text, facialExpression, and animation property.
        The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
        The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry. 
        `,
      },
      {
        role: "user",
        content: userMessage || "Hello",
      },
    ],
  });
  let messages;
  try {
    messages = JSON.parse(completion.choices[0].message.content);
    if (messages.messages) {
      messages = messages.messages; // ChatGPT is not 100% reliable, sometimes it directly returns an array and sometimes a JSON object with a messages property
    }
    if (!Array.isArray(messages)) {
      throw new Error("Unexpected messages format");
    }
  } catch (e) {
    // Fallback: treat the LLM reply as plain text
    const fallbackText = completion?.choices?.[0]?.message?.content || "";
    const cls = withSafeDefaults(classifyEmotionGesture(fallbackText));
    res.send({
      messages: [
        {
          text: fallbackText,
          facialExpression: cls.facialExpression,
          gesture: cls.gesture,
          intensity: cls.intensity,
          tempo: cls.tempo,
        },
      ],
    });
    return;
  }
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    // generate audio + lipsync with graceful fallback
    const fileName = `audios/message_${i}.mp3`;
    const textInput = message.text || "";
    try {
      await voice.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);
      await lipSyncMessage(i);
      message.audio = await audioFileToBase64(fileName);
      message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
    } catch (err) {
      console.error("TTS/Lipsync failed for message", i, err?.message || err);
      // Keep message valid without audio/lipsync
    }
    // classify and attach animation controls (non-breaking extension)
    try {
      const cls = withSafeDefaults(classifyEmotionGesture(textInput));
      message.facialExpression = message.facialExpression || cls.facialExpression;
      message.gesture = cls.gesture;
      message.intensity = cls.intensity;
      message.tempo = cls.tempo;
    } catch (_) {
      const safe = withSafeDefaults();
      message.facialExpression = message.facialExpression || safe.facialExpression;
      message.gesture = safe.gesture;
      message.intensity = safe.intensity;
      message.tempo = safe.tempo;
    }
  }

  res.send({ messages });
});

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
});
