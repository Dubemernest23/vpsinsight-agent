const { Resend } = require('resend');

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const severityColor = (severity) => {
  if (severity === 'critical') return { bg: '#450a0a', border: '#dc2626', badge: '#dc2626', text: '#fca5a5' };
  return { bg: '#451a03', border: '#d97706', badge: '#d97706', text: '#fcd34d' };
};

const metricIcon = (metric) => {
  if (metric?.startsWith('cpu'))    return '🖥️';
  if (metric?.startsWith('memory')) return '💾';
  if (metric?.startsWith('disk'))   return '💿';
  return '⚠️';
};

const buildHtmlEmail = (alert) => {
  const colors = severityColor(alert.severity);
  const icon   = metricIcon(alert.metric);
  const server = alert.serverName || alert.server || 'Unknown server';
  const ts     = alert.createdAt
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC'
      }).format(new Date(alert.createdAt)) + ' UTC'
    : new Date().toUTCString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VPSInsight Alert</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;border-radius:12px 12px 0 0;padding:28px 32px;border-bottom:1px solid #1e293b;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:-0.5px;">VPSInsight</span>
                    <span style="font-size:13px;color:#64748b;margin-left:10px;">Monitoring Alert</span>
                  </td>
                  <td align="right">
                    <span style="background:${colors.badge};color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">
                      ${alert.severity || 'alert'}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alert banner -->
          <tr>
            <td style="background:${colors.bg};border-left:4px solid ${colors.border};border-right:1px solid #1e293b;padding:20px 32px;">
              <p style="margin:0;font-size:20px;">${icon}</p>
              <p style="margin:8px 0 4px;font-size:17px;font-weight:600;color:${colors.text};">
                ${alert.message || alert.title || 'Threshold exceeded'}
              </p>
              <p style="margin:0;font-size:13px;color:#94a3b8;">
                Detected on <strong style="color:#e2e8f0;">${server}</strong>
              </p>
            </td>
          </tr>

          <!-- Metric details -->
          <tr>
            <td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:16px;">
                    <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">
                      Metric Details
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e293b;border-radius:8px;overflow:hidden;">
                      <tr style="background:#0a0f1e;">
                        <td style="padding:10px 16px;font-size:12px;color:#64748b;width:40%;border-bottom:1px solid #1e293b;">Server</td>
                        <td style="padding:10px 16px;font-size:13px;color:#e2e8f0;border-bottom:1px solid #1e293b;font-weight:500;">${server}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 16px;font-size:12px;color:#64748b;border-bottom:1px solid #1e293b;">Metric</td>
                        <td style="padding:10px 16px;font-size:13px;color:#e2e8f0;border-bottom:1px solid #1e293b;">${alert.label || alert.metric || 'unknown'}</td>
                      </tr>
                      <tr style="background:#0a0f1e;">
                        <td style="padding:10px 16px;font-size:12px;color:#64748b;border-bottom:1px solid #1e293b;">Current Value</td>
                        <td style="padding:10px 16px;font-size:13px;font-weight:700;color:${colors.text};border-bottom:1px solid #1e293b;">
                          ${alert.value != null ? `${parseFloat(alert.value).toFixed(1)}%` : 'unknown'}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 16px;font-size:12px;color:#64748b;border-bottom:1px solid #1e293b;">Threshold</td>
                        <td style="padding:10px 16px;font-size:13px;color:#e2e8f0;border-bottom:1px solid #1e293b;">
                          ${alert.threshold != null ? `${alert.threshold}%` : 'unknown'}
                        </td>
                      </tr>
                      <tr style="background:#0a0f1e;">
                        <td style="padding:10px 16px;font-size:12px;color:#64748b;">Severity</td>
                        <td style="padding:10px 16px;">
                          <span style="background:${colors.badge};color:#fff;font-size:11px;font-weight:600;padding:2px 10px;border-radius:12px;text-transform:uppercase;">
                            ${alert.severity || 'unknown'}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Progress bar -->
          <tr>
            <td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;padding:0 32px 24px;">
              <p style="margin:0 0 6px;font-size:12px;color:#64748b;">Usage level</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#1e293b;border-radius:4px;height:8px;overflow:hidden;">
                    <div style="background:${colors.badge};width:${Math.min(parseFloat(alert.value) || 0, 100)}%;height:8px;border-radius:4px;"></div>
                  </td>
                </tr>
              </table>
              <p style="margin:6px 0 0;font-size:12px;color:#64748b;text-align:right;">
                ${alert.value != null ? `${parseFloat(alert.value).toFixed(1)}%` : '--'}
              </p>
            </td>
          </tr>

          <!-- Timestamp & action -->
          <tr>
            <td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;border-top:1px solid #1e293b;padding:20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;color:#64748b;">
                    🕐 Detected at <strong style="color:#94a3b8;">${ts}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#080b12;border-radius:0 0 12px 12px;border:1px solid #1e293b;border-top:none;padding:16px 32px;">
              <p style="margin:0;font-size:12px;color:#334155;text-align:center;">
                Sent by <strong style="color:#475569;">VPSInsight</strong> &nbsp;·&nbsp; 
                Built by <strong style="color:#475569;">SideSkripts Technologies</strong> &nbsp;·&nbsp;
                <a href="https://github.com/Dubemernest23/vpsinsight-agent" style="color:#3b82f6;text-decoration:none;">GitHub</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const buildPlainText = (alert) => {
  const server = alert.serverName || alert.server || 'Unknown server';
  return [
    `VPSInsight — ${(alert.severity || 'ALERT').toUpperCase()}`,
    '─'.repeat(40),
    '',
    alert.message || alert.title || 'Threshold exceeded',
    '',
    `Server:    ${server}`,
    `Metric:    ${alert.label || alert.metric || 'unknown'}`,
    `Value:     ${alert.value != null ? `${parseFloat(alert.value).toFixed(1)}%` : 'unknown'}`,
    `Threshold: ${alert.threshold != null ? `${alert.threshold}%` : 'unknown'}`,
    `Severity:  ${alert.severity || 'unknown'}`,
    `Time:      ${alert.createdAt || new Date().toISOString()}`,
    '',
    '─'.repeat(40),
    'Sent by VPSInsight · SideSkripts Technologies',
    'https://github.com/Dubemernest23/vpsinsight-agent',
  ].join('\n');
};

const sendAlertEmail = async (alert) => {
  let resendApiKey, to, from;

  try {
    resendApiKey = getRequiredEnv('RESEND_API_KEY');
    to           = getRequiredEnv('ALERT_TO');
    from         = process.env.ALERT_FROM || 'VPSInsight <onboarding@resend.dev>';
  } catch (envError) {
    console.error('[alert] Environment variable error:', envError.message);
    throw envError;
  }

  const server  = alert.serverName || alert.server || 'Unknown server';
  const subject = alert.subject ||
    `[VPSInsight] ${(alert.severity || 'ALERT').toUpperCase()}: ${alert.label || alert.metric || 'Server alert'} on ${server}`;

  console.log(`[alert] Sending to ${to} | subject: ${subject}`);

  let data, error;

  try {
    const resend = new Resend(resendApiKey);
    ({ data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: buildHtmlEmail(alert),
      text: buildPlainText(alert),
    }));
  } catch (sendError) {
    console.error('[alert] Resend SDK error:', sendError.message);
    throw new Error(`Resend SDK error: ${sendError.message}`);
  }

  if (error) {
    console.error('[alert] Resend API error:', JSON.stringify(error));
    throw new Error(error.message || 'Resend API returned an error');
  }

  console.log(`[alert] Email sent | id: ${data?.id}`);
  return data;
};

module.exports = { sendAlertEmail };