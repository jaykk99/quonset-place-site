// nav scroll state + mobile menu
const nav=document.getElementById('nav'),burger=document.getElementById('burger'),navLinks=document.getElementById('navLinks');
addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>40),{passive:true});
burger.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');burger.setAttribute('aria-expanded',open);});
navLinks.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>navLinks.classList.remove('open')));

// scroll reveals
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
window.qpObserveReveals=root=>root.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// ---- sending quote/order requests ----
// Sends straight to the business inbox via FormSubmit (no backend needed).
// Falls back to the visitor's email app if that fails. The phone number is
// used for the "Text it instead" button.
window.QP_CONTACT = { email: 'thequonsetplace@hotmail.com', sms: '+12049720325' };
window.qpSend = async function (subject, lines, fields) {
  const body = lines.join('\n');
  try {
    const res = await fetch('https://formsubmit.co/ajax/' + QP_CONTACT.email, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.assign({ _subject: subject, _template: 'box', _captcha: 'false', message: body }, fields || {}))
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && String(data.success) === 'true') return 'sent';
  } catch (e) { /* network or blocked: fall back below */ }
  location.href = 'mailto:' + QP_CONTACT.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  return 'mailto';
};
window.qpSmsLink = function (text) {
  return 'sms:' + QP_CONTACT.sms + '?&body=' + encodeURIComponent(text);
};
