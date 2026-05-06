const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// 🚨 API Key ของบอส
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log("KEY:", process.env.GEMINI_API_KEY);

app.post('/api/generate-story', async (req, res) => {
    try {
        // รับค่า theme เพิ่มเติมมาจากหน้าบ้าน
        const { action, history, turnCount, theme } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemma-3-1b" });

        // ขยายเวลาการเล่นให้นานขึ้นเป็น 6 ตา เพื่อให้เนื้อเรื่องไม่งง
        const isFinalTurn = turnCount >= 6;

        // --- จุดที่ 1: Prompt สำหรับเนื้อเรื่องปกติ ---
        // ในไฟล์ server.js
        let systemPrompt = `คุณคือ AI นักแต่งนิทาน RPG ธีมหลัก: "${theme || 'นิทานทั่วไป'}"
กฎเหล็กในการตอบ:
1. แต่งเนื้อเรื่องให้สั้นกระชับ (ห้ามเกิน 3 ประโยค) ภาษาไทยเข้าใจง่าย
2. คิด image_prompt เป็นภาษาอังกฤษ โดยต้องระบุสไตล์ภาพด้วยเสมอ เช่น "Storybook illustration, 2D art, [ชื่อตัวละคร/ฉาก]" 
3. ห้ามใช้คำกำกวมใน image_prompt ให้เน้นที่ตัวละครและสิ่งที่เกิดขึ้นในฉากนั้นๆ
4. ส่งผลลัพธ์เป็น JSON: { "story": "...", "image_prompt": "...", "choices": ["...", "..."], "is_ending": false }`;

        // --- จุดที่ 2: Prompt สำหรับตอนจบ (isFinalTurn) ---
        if (isFinalTurn) {
            systemPrompt = `นิทานธีม "${theme}" มาถึงบทสรุปแล้ว
กฎเหล็กในการตอบ:
1. แต่งบทสรุปตอนจบให้สวยงามประทับใจ (ห้ามเกิน 3 ประโยค)
2. คิดคำอธิบายภาพตอนจบ (image_prompt) เป็นภาษาอังกฤษสั้นๆ ตรงประเด็น
3. ส่งผลลัพธ์เป็น JSON เป๊ะๆ โครงสร้างนี้เท่านั้น: { "story": "บทสรุปจบ...", "image_prompt": "english final prompt...", "choices": [], "is_ending": true }`;
        }

        const prompt = `${systemPrompt}\n\nประวัติการเล่าที่ผ่านมา: ${history}\nสิ่งที่เกิดขึ้นล่าสุด/ผู้เล่นเลือก: ${action}\nแต่งนิทานต่อจากนี้ในรูปแบบ JSON:`;

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
        console.error("เชี่ยบอส Error ว่ะ:", error);
        // ถ้า Google เอ๋อ (503) จะส่ง Error ไปบอกหน้าบ้าน
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('🐜 Backend รันที่พอร์ต 3000 แล้ว!'));
