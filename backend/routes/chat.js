const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const pool = require("../config/db");

// Define Tools
const tools = [
  {
    functionDeclarations: [
      {
        name: "get_my_leave_balance",
        description: "Retrieves the current user's leave balances including allocated and used days for the current year.",
        parameters: { type: SchemaType.OBJECT, properties: {} }
      },
      {
        name: "get_employee_count",
        description: "Retrieves the total number of active employees in the company. Useful for managers/admins.",
        parameters: { type: SchemaType.OBJECT, properties: {} }
      },
      {
        name: "get_current_date",
        description: "Returns today's date.",
        parameters: { type: SchemaType.OBJECT, properties: {} }
      },
      {
        name: "get_my_attendance_today",
        description: "Retrieves the attendance record for the current user for today, including check-in time and status.",
        parameters: { type: SchemaType.OBJECT, properties: {} }
      }
    ]
  }
];

router.post("/", authenticate, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        success: false, 
        message: "Gemini API key is not configured on the server." 
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: tools
    });

    // Format history for Gemini
    const formattedHistory = history.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const systemInstruction = `You are a helpful HR Assistant chatbot for a company using Pulse HRMS (Human Resource Management System). 
You help employees and admins with HR policies, navigation, and general assistance. 
You can use tools to fetch real-time data from the database when asked. 
Keep your answers concise, friendly, and professional. 
Do not make up private company data. 
Current User's Name/Email: ${req.user.email}
User Role: ${req.user.role}`;

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "System prompt: " + systemInstruction + "\n\nAcknowledge this and wait for my next message." }]
        },
        {
          role: "model",
          parts: [{ text: "Understood. I am ready to help as the HR Assistant and will use my tools when needed." }]
        },
        ...formattedHistory
      ],
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(message);

    // Handle Function Calling
    if (result.response.functionCalls && result.response.functionCalls()) {
      const functionCalls = result.response.functionCalls();
      const functionResponses = [];

      for (const call of functionCalls) {
        let apiResponse = {};
        const functionName = call.name;
        
        try {
          if (functionName === "get_my_leave_balance") {
            const empQuery = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
            if (empQuery.rows.length > 0) {
              const empId = empQuery.rows[0].id;
              const currentYear = new Date().getFullYear();
              const leaves = await pool.query("SELECT leave_type, allocated, used FROM leave_balances WHERE employee_id = $1 AND year = $2", [empId, currentYear]);
              apiResponse = { success: true, balances: leaves.rows };
            } else {
              apiResponse = { success: false, error: "Employee record not found for this user." };
            }
          } 
          else if (functionName === "get_employee_count") {
            if (req.user.role === 'admin' || req.user.role === 'hr_manager') {
              const countQuery = await pool.query("SELECT COUNT(*) FROM employees WHERE status = 'active'");
              apiResponse = { success: true, active_employees: parseInt(countQuery.rows[0].count) };
            } else {
              apiResponse = { success: false, error: "You do not have permission to view total employee counts. Only Admins and HR Managers can." };
            }
          } 
          else if (functionName === "get_current_date") {
            apiResponse = { success: true, date: new Date().toDateString() };
          }
          else if (functionName === "get_my_attendance_today") {
            const empQuery = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
            if (empQuery.rows.length > 0) {
              const empId = empQuery.rows[0].id;
              // using IST date approach as used elsewhere
              const now = new Date();
              const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
              const att = await pool.query("SELECT check_in, check_out, status FROM attendance WHERE employee_id = $1 AND work_date = $2", [empId, istDate]);
              if (att.rows.length > 0) {
                apiResponse = { success: true, attendance: att.rows[0] };
              } else {
                apiResponse = { success: true, message: "No attendance record found for today." };
              }
            } else {
              apiResponse = { success: false, error: "Employee record not found for this user." };
            }
          }
          else {
            apiResponse = { success: false, error: "Unknown function" };
          }
        } catch (e) {
          apiResponse = { success: false, error: e.message };
        }

        functionResponses.push({
          functionResponse: {
            name: functionName,
            response: apiResponse
          }
        });
      }

      // Send the function responses back to the model to get final text
      const finalResult = await chat.sendMessage(functionResponses);
      return res.json({
        success: true,
        message: finalResult.response.text()
      });
    }

    // Standard text response (no tool called)
    res.json({
      success: true,
      message: result.response.text()
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "An error occurred while communicating with the AI.",
      error: error.message
    });
  }
});

module.exports = router;
