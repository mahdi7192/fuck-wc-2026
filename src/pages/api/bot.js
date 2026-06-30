import { saveTelegramChatId, getTelegramChatIds } from '../../utils/db.js';

export const prerender = false;

export async function POST({ request }) {
  const token = (typeof process !== 'undefined' && process.env?.TELEGRAM_BOT_TOKEN) || 
                (typeof import.meta !== 'undefined' && import.meta.env?.TELEGRAM_BOT_TOKEN);
  
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN environment variable is missing.');
    return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN is not configured" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const payload = await request.json();
    const message = payload.message || payload.edited_message;

    if (message && message.chat && message.chat.id) {
      const chatId = message.chat.id;
      
      // Save user's chat ID
      await saveTelegramChatId(chatId);

      const text = message.text || '';
      const trimmedText = text.trim();
      const lowerText = trimmedText.toLowerCase();

      if (lowerText.startsWith('asdfgh')) {
        const broadcastText = trimmedText.substring('asdfgh'.length).trim();
        if (broadcastText) {
          const chatIds = await getTelegramChatIds();
          
          let successCount = 0;
          let failCount = 0;

          // Send message to all users
          const sendPromises = chatIds.map(async (targetChatId) => {
            try {
              const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  chat_id: targetChatId,
                  text: broadcastText,
                }),
              });
              if (res.ok) {
                successCount++;
              } else {
                failCount++;
                console.error(`Failed to send broadcast to ${targetChatId}:`, await res.text());
              }
            } catch (err) {
              failCount++;
              console.error(`Error sending broadcast to ${targetChatId}:`, err);
            }
          });

          await Promise.allSettled(sendPromises);

          // Reply back to the admin sender with status
          const statusText = `پیام شما با موفقیت به ${successCount} کاربر ارسال شد.\nخطا در ارسال به ${failCount} کاربر.`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: statusText,
            }),
          });
        }
      } else {
        const responseText = "به استادیوم بنجل‌ها خوش آمدید! 🏟️\n\nدر جریان بازی‌های زنده جام جهانی بازیکنان و تیم‌های بنجل را هو کنید و بنجل‌ترین‌های مسابقات را انتخاب کنید.";
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const telegramRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: responseText,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "ورود به استادیوم بنجل‌ها 🏟️",
                    web_app: {
                      url: "https://bonjol-wc-2026.vercel.app/"
                    }
                  }
                ]
              ]
            }
          }),
        });

        if (!telegramRes.ok) {
          console.error('Telegram API error response:', await telegramRes.text());
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Telegram bot webhook handler error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
