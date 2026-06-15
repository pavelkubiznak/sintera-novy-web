/**
 * Sintera · seznam free / konzumních e-mailových domén.
 * Slouží k tomu, aby reference dostaly jen firemní (pracovní) e-maily.
 *
 * POZOR: stejný seznam je zrcadlově i v apps-script/Code.gs (FREE_DOMAINS).
 * Když ho měníš tady, změň ho i tam, ať se frontend a backend shodují.
 *
 * Použití (frontend):
 *   import { isFreeEmailDomain } from './free-domains.js'
 *   isFreeEmailDomain('jan@seznam.cz')   // true  -> odmítnout
 *   isFreeEmailDomain('jan@skoda.cz')    // false -> firemní, OK
 */

var FREE_EMAIL_DOMAINS = [
  // Česko
  'seznam.cz', 'email.cz', 'post.cz', 'centrum.cz', 'atlas.cz', 'volny.cz',
  'tiscali.cz', 'quick.cz', 'chello.cz', 'iol.cz', 'sweb.cz', 'mybox.cz',
  'raz-dva.cz', 'email.com',
  // Slovensko (časté i u CZ firem)
  'azet.sk', 'zoznam.sk', 'post.sk', 'centrum.sk', 'pobox.sk', 'inmail.sk',
  // Google
  'gmail.com', 'googlemail.com',
  // Microsoft
  'outlook.com', 'outlook.cz', 'hotmail.com', 'hotmail.cz', 'live.com',
  'live.cz', 'msn.com',
  // Yahoo
  'yahoo.com', 'yahoo.co.uk', 'yahoo.cz', 'ymail.com', 'rocketmail.com',
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  // Proton
  'proton.me', 'protonmail.com', 'pm.me',
  // ostatní mezinárodní
  'gmx.com', 'gmx.net', 'gmx.de', 'mail.com', 'aol.com', 'zoho.com',
  'yandex.com', 'yandex.ru', 'web.de', 'freenet.de', 'fastmail.com',
  'tutanota.com', 'tuta.io', 'hey.com'
];

/** Vrátí doménu z e-mailu malými písmeny, nebo '' když e-mail není platný. */
function emailDomain(email) {
  if (typeof email !== 'string') return '';
  var m = email.trim().toLowerCase().match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/);
  return m ? m[1] : '';
}

/** true = free/konzumní doména (reference NEposílat). false = firemní nebo neplatný. */
function isFreeEmailDomain(email) {
  var d = emailDomain(email);
  if (!d) return false; // neplatný e-mail řeší zvlášť validace formátu
  return FREE_EMAIL_DOMAINS.indexOf(d) !== -1;
}

/** true = e-mail má platný formát. */
function isValidEmail(email) {
  return emailDomain(email) !== '';
}

// ESM export (frontend). V Apps Scriptu se tenhle soubor nepoužívá.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FREE_EMAIL_DOMAINS: FREE_EMAIL_DOMAINS, emailDomain: emailDomain, isFreeEmailDomain: isFreeEmailDomain, isValidEmail: isValidEmail };
}
