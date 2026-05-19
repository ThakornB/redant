const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// 🚨 API Key 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


app.post('/api/generate-story', async (req, res) => {
    try {
        // รับค่า theme เพิ่มเติมมาจากหน้าบ้าน
        const { action, history, turnCount, theme } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

        // --- Unified Game Master Prompt ---
        const systemPrompt = `คุณคือ Game Master ผู้เล่าเรื่อง RPG สไตล์ไทย ธีมหลัก: "${theme || 'นิทานทั่วไป'}"

หน้าที่ของคุณคือวิเคราะห์การกระทำของผู้เล่นและตัดสินใจว่าเรื่องควรดำเนินต่อหรือจบลงอย่างเป็นธรรมชาติ

กฎเหล็ก:
1. แต่งเนื้อเรื่องให้สั้นกระชับ (ไม่เกิน 3 ประโยค) ภาษาไทยเข้าใจง่าย
2. คิด image_prompt เป็นภาษาอังกฤษ ระบุสไตล์ภาพเสมอ เช่น "Storybook illustration, 2D art, [scene]"
3. ห้ามใช้คำกำกวมใน image_prompt ให้เน้นตัวละครและเหตุการณ์ในฉาก
4. วิเคราะห์ว่าการกระทำของผู้เล่นนำไปสู่บทสรุปหรือไม่:
   - ถ้าผู้เล่น ชนะบอส / เสียชีวิต / บรรลุเป้าหมาย / หรือเรื่องถึงจุดจบตามธรรมชาติ → ตั้ง "is_ending": true
   - ถ้าเรื่องควรดำเนินต่อไป → ตั้ง "is_ending": false
5. เมื่อ is_ending เป็น true: วิเคราะห์ประวัติการตัดสินใจของผู้เล่นทั้งหมด สร้าง stats 3 ข้อสะท้อนบุคลิกภาพ (0-100) ห้ามให้ทุกข้อเท่ากัน และตั้ง choices เป็น []
6. เมื่อ is_ending เป็น false: ให้ 2 ตัวเลือกใน choices

รูปแบบ JSON ที่ต้องส่งกลับเสมอ:
{ "story": "...", "image_prompt": "...", "choices": ["...", "..."], "is_ending": false }
หรือเมื่อจบเรื่อง:
{ "story": "...", "image_prompt": "...", "choices": [], "is_ending": true, "stats": [{"trait": "ชื่อคุณลักษณะ", "value": 80}, {"trait": "ชื่อคุณลักษณะ", "value": 45}, {"trait": "ชื่อคุณลักษณะ", "value": 90}] }`;

        // --- Failsafe: force ending if story runs too long ---
        let failsafeInstruction = "";
        if (turnCount >= 10) {
            failsafeInstruction = "\n\nCRITICAL RULE: The story has been going on for too long. You MUST wrap up the story gracefully in this turn, provide a final conclusion, and set 'is_ending': true with empty choices.";
        }

        const prompt = `${systemPrompt}\n\nประวัติการเล่าที่ผ่านมา: ${history}\nสิ่งที่เกิดขึ้นล่าสุด/ผู้เล่นเลือก: ${action}\nแต่งนิทานต่อจากนี้ในรูปแบบ JSON:${failsafeInstruction}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // 🛠️ ทำความสะอาดข้อมูล JSON ก่อนส่งออก
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const startJson = text.indexOf('{');
        const endJson = text.lastIndexOf('}') + 1;
        const cleanedJson = text.substring(startJson, endJson);

        console.log(`[Theme: ${theme}] AI ตอบมาว่า:`, cleanedJson);
        res.json(JSON.parse(cleanedJson));

    } catch (error) {
        console.error("Error :", error);

        const errorMsg = error.message ? error.message.toLowerCase() : "";
        if (error.status === 429 || errorMsg.includes("quota") || errorMsg.includes("429")) {
            return res.json({
                story: "⚠️ ระบบขัดข้อง: พลังงานจินตนาการของ AI ประจำวันหมดแล้ว! โปรดแวะมาผจญภัยใหม่ในวันพรุ่งนี้นะครับ",
                image_prompt: "A sleeping cute red ant, tired, storybook style",
                choices: [],
                is_ending: true
            });
        }

        // ถ้า Google เอ๋อ (503) หรือ error อื่นๆ
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('🐜 Backend รันที่พอร์ต 3000 แล้ว!'));
