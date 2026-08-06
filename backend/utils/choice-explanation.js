'use strict';

const ADVERTISEMENT_RE = /小初高期中末\s*中考高考真题\s*加微咨询\s*天猫(?:\s*[：:]\s*|\s*[（(]禾册[）)]\s*)?hece\.tmall\.com/giu;
const COPYRIGHT_WATERMARK_RE = /\s*(?:\d+\s*)?原创精品资源学科网独家享有版权[，,]\s*侵权必究[！!]?\s*(?:\{#\{[^{}]*\}#\})?/gu;
const ENCODED_RESIDUE_RE = /\{#\{[A-Za-z0-9+/=\s]+\}#\}/gu;

function sanitizeChoiceExplanation(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  const sanitized = source
    .replace(ADVERTISEMENT_RE, ' ')
    .replace(COPYRIGHT_WATERMARK_RE, ' ')
    .replace(ENCODED_RESIDUE_RE, ' ');
  if (sanitized === source) return source;
  return sanitized
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/[ \t]+([，。；：、,.!?])/gu, '$1')
    .trim();
}

module.exports = { sanitizeChoiceExplanation };
