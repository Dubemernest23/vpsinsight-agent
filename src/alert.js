const { Resend } = require('resend');

const getRequiredEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
};

const formatAlertText = (alert) => {
  const lines = [
    alert.message,
    '',
    `Severity: ${alert.severity || 'unknown'}`,
    `Server: ${alert.server || 'unknown'}`,
    `Metric: ${alert.metric || 'unknown'}`,
    `Value: ${alert.value ?? 'unknown'}`,
    `Threshold: ${alert.threshold ?? 'unknown'}`,
    `Timestamp: ${alert.timestamp || new Date().toISOString()}`
  ];

  return lines.join('\n');
};

const sendAlertEmail = async (alert) => {
  const resend = new Resend(getRequiredEnv('RESEND_API_KEY'));
  const to = getRequiredEnv('ALERT_TO');
  const from = process.env.ALERT_FROM || 'VPSInsight <onboarding@resend.dev>';
  const subject = alert.subject || `[VPSInsight] ${alert.title || 'Server alert'}`;

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    text: formatAlertText(alert)
  });

  if (error) {
    throw new Error(error.message || 'Failed to send alert email');
  }

  return data;
};

module.exports = { sendAlertEmail };
