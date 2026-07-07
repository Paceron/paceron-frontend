// Dominios de email desechable/temporal mas comunes — expandir segun necesidad
const DISPOSABLE_DOMAINS = new Set([
  '0815.ru', '0815.su', '10minutemail.com', '10minutemail.net', '20minutemail.com',
  'binkmail.com', 'bobmail.info', 'chammy.info', 'chong-mail.com', 'chong-mail.net',
  'cloakmail.com', 'cmail.club', 'discardmail.com', 'discardmail.de',
  'dispostable.com', 'discard.email', 'emailondeck.com',
  'fakeinbox.com', 'fakeinbox.info', 'filzmail.com',
  'getairmail.com', 'grr.la', 'guerrillamail.biz', 'guerrillamail.com',
  'guerrillamail.de', 'guerrillamail.info', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamailblock.com', 'incognitomail.com', 'incognitomail.net', 'incognitomail.org',
  'jetable.com', 'jetable.fr.nf', 'jetable.net', 'jetable.org', 'jourrapide.com',
  'kasmail.com', 'lortemail.dk', 'maildrop.cc', 'mailexpire.com', 'mailforspam.com',
  'mailguard.me', 'mailimate.com', 'mailinator.com', 'mailinator.net',
  'mailme.lv', 'mailme24.com', 'mailmetrash.com', 'mailmoat.com',
  'mailnesia.com', 'mailnew.com', 'mailnull.com', 'mailquack.com',
  'mailrock.biz', 'mailseal.de', 'mailtemp.info', 'mailtome.de',
  'mailtothis.com', 'mailtrash.net', 'mailzilla.com', 'mailzilla.org',
  'makemetheking.com', 'manybrain.com', 'mr24.co',
  'nospamfor.us', 'notsharingmy.info', 'rhyta.com', 'sharklasers.com',
  'spamdecoy.net', 'spamevader.com', 'spamgourmet.com', 'spamgourmet.net',
  'spamgourmet.org', 'spamspot.com', 'spam4.me', 'spam.la',
  'supergreatmail.com', 'temp-mail.org', 'tempalias.com', 'tempail.com',
  'tempr.email', 'throwaway.email', 'tmailinator.com',
  'trashcanmail.com', 'trashdevil.com', 'trashdevil.de', 'trashemail.de',
  'trashimail.com', 'trashinbox.com', 'trashmail.app', 'trashmail.at',
  'trashmail.com', 'trashmail.de', 'trashmail.io', 'trashmail.me',
  'trashmail.net', 'trashmail.org', 'trashmail.xyz', 'trashmailer.com',
  'trbvm.com', 'trbvn.com', 'wegwerfmail.de', 'wegwerfmail.net',
  'wegwerfmail.org', 'whyspam.me', 'wilemail.com',
  'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'zehnminuten.de', 'zehnminutenmail.de', 'zoemail.net', 'zoemail.org',
]);

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export function validateEmailFormat(email) {
  return EMAIL_REGEX.test(email.trim());
}

export function isDisposableEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}
