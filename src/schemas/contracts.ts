import { z } from "zod";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional();
const point = z.object({ x: z.number().min(0).max(1000), y: z.number().min(0).max(560) });
const base = { x: z.number().min(0).max(1000), y: z.number().min(0).max(560), stroke: color, fill: color };
const commandUnion = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), ...base, text: z.string().min(1).max(180), fontSize: z.number().int().min(10).max(48).optional() }),
  z.object({ type: z.literal("equation"), ...base, text: z.string().min(1).max(100), fontSize: z.number().int().min(16).max(52).optional() }),
  z.object({ type: z.literal("line"), ...base, points: z.array(z.number().min(0).max(1000)).min(4).max(40) }),
  z.object({ type: z.literal("arrow"), ...base, points: z.array(z.number().min(0).max(1000)).length(4) }),
  z.object({ type: z.literal("rect"), ...base, width: z.number().min(1).max(500), height: z.number().min(1).max(400), cornerRadius: z.number().min(0).max(32).optional() }),
  z.object({ type: z.literal("circle"), ...base, radius: z.number().min(1).max(180) }),
  z.object({ type: z.literal("triangle"), ...base, width: z.number().min(1).max(500), height: z.number().min(1).max(400) }),
  z.object({ type: z.literal("polygon"), ...base, points: z.array(z.number().min(0).max(1000)).min(6).max(32) }),
  z.object({ type: z.literal("label"), ...base, text: z.string().min(1).max(80), target: point, fontSize: z.number().int().min(10).max(30).optional() }),
  z.object({ type: z.literal("highlight"), ...base, width: z.number().min(1).max(500), height: z.number().min(1).max(400) }),
]);
export const drawCommandSchema = commandUnion.superRefine((command, ctx) => {
  if ("points" in command) for (let i = 1; i < command.points.length; i += 2) if (command.points[i] > 560) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Point y coordinate exceeds the canvas", path: ["points", i] });
  if ((command.type === "rect" || command.type === "triangle" || command.type === "highlight") && (command.x + command.width > 1000 || command.y + command.height > 560)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Shape exceeds the canvas" });
  if (command.type === "circle" && (command.x - command.radius < 0 || command.x + command.radius > 1000 || command.y - command.radius < 0 || command.y + command.radius > 560)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Circle exceeds the canvas" });
});
export const lessonStepSchema = z.object({ id: z.string().min(1).max(40), explanation: z.string().min(1).max(700), narration: z.string().min(1).max(500), durationMs: z.number().int().min(1000).max(20000).default(5000), drawCommands: z.array(drawCommandSchema).max(30) });
export const lessonSchema = z.object({ lessonId: z.string().min(1).max(80), title: z.string().min(1).max(100), summary: z.string().min(1).max(300), steps: z.array(lessonStepSchema).min(2).max(8), followUpSuggestions: z.array(z.string().min(1).max(100)).max(4), demo: z.boolean().default(false) });
export const lessonRequestSchema = z.object({ question: z.string().trim().min(3).max(500), subject: z.enum(["mathematics", "science", "general"]).default("mathematics"), level: z.enum(["beginner", "intermediate"]).default("beginner"), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(700) })).max(8).default([]), lessonContext: z.object({ title: z.string().max(100), summary: z.string().max(300) }).optional() });
export type DrawCommand = z.infer<typeof drawCommandSchema>;
export type LessonStep = z.infer<typeof lessonStepSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type LessonRequest = z.infer<typeof lessonRequestSchema>;

export const sampleLesson: Lesson = {
  lessonId: "demo-pythagorean", title: "The Pythagorean theorem", summary: "See how the squares on the short sides relate to the square on the longest side.", demo: true,
  followUpSuggestions: ["Why do we square the sides?", "Show me a numeric example", "What does the hypotenuse mean?"],
  steps: [
    { id: "step-1", explanation: "A right triangle has one square corner: a 90° angle. The side opposite that corner is the hypotenuse, c.", narration: "Let's start with a right triangle. The side opposite the right angle is called the hypotenuse.", durationMs: 5500, drawCommands: [{ type: "triangle", x: 260, y: 140, width: 300, height: 220, stroke: "#7667e8", fill: "#f1efff" }, { type: "rect", x: 260, y: 330, width: 26, height: 26, stroke: "#29846f", fill: "#e7f6f1", cornerRadius: 2 }, { type: "label", x: 300, y: 365, text: "a", target: { x: 295, y: 245 }, stroke: "#29846f" }, { type: "label", x: 510, y: 245, text: "b", target: { x: 490, y: 355 }, stroke: "#dd8b4a" }, { type: "label", x: 380, y: 140, text: "c · hypotenuse", target: { x: 400, y: 250 }, stroke: "#7667e8" }, { type: "text", x: 270, y: 390, text: "one right angle = 90°", fontSize: 17, fill: "#5f6278" }] },
    { id: "step-2", explanation: "Imagine building a square on each side. The two smaller square areas together exactly fill the square on the hypotenuse.", narration: "Now picture a square attached to each side. The areas of the two smaller squares add up to the area on the longest side.", durationMs: 6500, drawCommands: [{ type: "highlight", x: 250, y: 105, width: 330, height: 300, stroke: "#d9d5ff", fill: "#f8f7ff" }, { type: "equation", x: 300, y: 180, text: "area on a + area on b", fill: "#20243a", fontSize: 28 }, { type: "equation", x: 370, y: 245, text: "= area on c", fill: "#7667e8", fontSize: 34 }, { type: "arrow", x: 280, y: 340, points: [280, 340, 430, 340], stroke: "#dd8b4a" }, { type: "text", x: 300, y: 365, text: "The areas combine — the lengths do not.", fontSize: 17, fill: "#5f6278" }] },
    { id: "step-3", explanation: "A square with side a has area a². So the relationship becomes a² + b² = c². This works for every right triangle.", narration: "Because a square's area is side times side, we write a squared plus b squared equals c squared. Let's try three, four, five.", durationMs: 6500, drawCommands: [{ type: "equation", x: 335, y: 115, text: "a² + b² = c²", fill: "#7667e8", fontSize: 45 }, { type: "rect", x: 255, y: 220, width: 120, height: 120, stroke: "#29846f", fill: "#e7f6f1" }, { type: "text", x: 270, y: 270, text: "3² = 9", fontSize: 24, fill: "#20243a" }, { type: "text", x: 395, y: 270, text: "+", fontSize: 25, fill: "#85899f" }, { type: "rect", x: 445, y: 220, width: 120, height: 120, stroke: "#dd8b4a", fill: "#fff2e7" }, { type: "text", x: 460, y: 270, text: "4² = 16", fontSize: 24, fill: "#20243a" }, { type: "arrow", x: 580, y: 280, points: [580, 280, 680, 280], stroke: "#7667e8" }, { type: "equation", x: 690, y: 260, text: "5² = 25", fill: "#7667e8", fontSize: 25 }, { type: "text", x: 310, y: 390, text: "9 + 16 = 25 ✓", fontSize: 24, fill: "#29846f" }] }
  ]
};
