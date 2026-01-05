Accounts.config({
  forbidClientAccountCreation: true,
  // Only send verification emails when a mail transport is configured.
  // (Local dev/test environments typically don't set MAIL_URL.)
  sendVerificationEmail: Boolean(process.env.MAIL_URL),
});
