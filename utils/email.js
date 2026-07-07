const { Resend } = require("resend");
const logger = require("./logger");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Unified email dispatch helper with SaaS routing, safe error normalization,
 * idempotency enforcement, and non-blocking MongoDB logging.
 */
exports.sendEmail = async ({ type, to, subject, html, tenantId, tenantName, idempotencyKey }) => {
  // 1. Strict Validation & Normalization
  const normalizedType = ["SYSTEM", "SUPPORT"].includes(type) ? type : "SYSTEM";
  const normalizedTo = Array.from(new Set(Array.isArray(to) ? to : [to]));

  // 2. Resolve Sender Identity & Branding Safety
  let fromEmail = "noreply@inventordesignstudio.io";
  let fromName = "Inventor CMS";

  if (normalizedType === "SUPPORT") {
    fromEmail = "support@inventordesignstudio.io";
    fromName = "Support";
  } else if (normalizedType === "SYSTEM" && tenantName) {
    fromName = `Inventor CMS - ${tenantName}`;
  }

  // 3. Idempotency Guard
  const EmailLog = require("../models/EmailLog");
  if (idempotencyKey) {
    try {
      const existingLog = await EmailLog.findOne({ idempotencyKey, success: true });
      if (existingLog) {
        logger.info(`[EMAIL DEDUPLICATED] IdempotencyKey matches previous successful send: ${idempotencyKey}`);
        return { success: true, duplicated: true, resendEmailId: existingLog.resendEmailId };
      }
    } catch (dbErr) {
      logger.warn(`Failed checking idempotency in MongoDB: ${dbErr.message}`);
    }
  }

  let success = false;
  let status = "FAILED";
  let resendEmailId = null;
  let errorMessage = null;

  // 4. Try sending the email via Resend API
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: normalizedTo,
        subject,
        html,
      });

      if (error) {
        errorMessage = String(error.message || error || "Unknown Resend API error");
      } else {
        success = true;
        status = "SENT";
        resendEmailId = data?.id || null;
      }
    } catch (err) {
      errorMessage = String(err.message || err || "Resend client request execution crash");
    }
  } else {
    // Local fallback log if Resend API key is missing
    logger.info(`[EMAIL SYSTEM FALLBACK] Send simulated to ${normalizedTo.join(", ")}`);
    console.log(`\n============================================================`);
    console.log(`FROM: ${fromName} <${fromEmail}>`);
    console.log(`TO: ${normalizedTo.join(", ")}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`CONTENT: ${html}`);
    console.log(`============================================================\n`);
    success = true;
    status = "SENT";
  }

  // 5. Non-Blocking MongoDB Logging
  // Executed asynchronously to guarantee the active email dispatch flow is not blocked.
  (async () => {
    try {
      await EmailLog.create({
        type: normalizedType,
        to: normalizedTo,
        from: `${fromName} <${fromEmail}>`,
        subject,
        status,
        success,
        errorMessage,
        tenantId: tenantId || null,
        resendEmailId,
        idempotencyKey: idempotencyKey || null,
      });
    } catch (logErr) {
      logger.warn(`[WARNING] Non-blocking email logger failed to save in MongoDB: ${logErr.message}. Target recipients: ${normalizedTo.join(", ")}`);
    }
  })();

  return { success, status, resendEmailId, errorMessage };
};

/**
 * Dispatches a workspace invitation email.
 * Delegates execution to the unified sendEmail abstraction layer.
 */
exports.sendInvitationEmail = async (email, portalName, rawToken, role = "operator", tenantId = null) => {
  const inviteLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/invite/accept?token=${rawToken}`;
  
  logger.info(`[EMAIL DISPATCHED] To: ${email} | Workspace: ${portalName}`);

  const html = `
    <div>
      <h2>You're invited</h2>
      <p><b>Role:</b> ${role}</p>
      <p>You have been invited to join <b>${portalName}</b></p>
      <br/>
      <a href="${inviteLink}" style="padding:10px 16px;background:#000;color:#fff;text-decoration:none;border-radius:6px;display:inline-block;">
        Accept Invitation
      </a>
      <br/><br/>
      <p>This link expires in 48 hours.</p>
    </div>
  `;

  // Delegate dispatching to the unified sendEmail helper
  const result = await exports.sendEmail({
    type: "SYSTEM",
    to: email,
    subject: `You're invited to join ${portalName}`,
    html,
    tenantId,
    tenantName: portalName,
    idempotencyKey: `invite-${rawToken}`,
  });

  return result.success;
};
