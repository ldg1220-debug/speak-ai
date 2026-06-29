import { Type, type FunctionDeclaration } from "@google/genai";

export const REPORT_TURN_TOOL_NAME = "reportTurn";

export const reportTurnDeclaration: FunctionDeclaration = {
  name: REPORT_TURN_TOOL_NAME,
  description:
    "Logs metadata about the spoken turn you just took — a brief correction tip (if the learner made an English mistake) and the emotional tone of the exchange. Call this after every spoken reply.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      correction: {
        type: Type.STRING,
        description:
          "A brief, friendly correction or natural-phrasing tip if the learner's English had an error. Omit or leave empty if their English was correct or they spoke Korean.",
      },
      emotion: {
        type: Type.STRING,
        description: "The emotional tone of your reply.",
        enum: ["happy", "neutral", "surprised", "sad", "thinking"],
      },
    },
    required: ["emotion"],
  },
};
