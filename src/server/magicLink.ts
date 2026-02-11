export type SendMagicLinkEmailInput = {
  to: string;
  magicLink: string;
  expiresMinutes: number;
};

export type SendMagicLinkEmailResult = {
  sent: boolean;
  reason?: string;
};

export const sendMagicLinkEmail = async (
  input: SendMagicLinkEmailInput,
): Promise<SendMagicLinkEmailResult> => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return {
      sent: false,
      reason: "Email provider is not configured",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.to],
      subject: "Your DaBus sign-in link",
      html: `<p>Hello,</p><p>Use this secure link to sign in to DaBus:</p><p><a href=\"${input.magicLink}\">Sign in to DaBus</a></p><p>This link expires in ${input.expiresMinutes} minutes.</p>`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      sent: false,
      reason: text || "Email provider request failed",
    };
  }

  return { sent: true };
};
