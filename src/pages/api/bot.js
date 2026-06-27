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
                    url: "https://bonjol-stadium-2026.vercel.app/"
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
