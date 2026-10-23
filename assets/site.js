// nav scroll state + mobile menu
const nav=document.getElementById('nav'),burger=document.getElementById('burger'),navLinks=document.getElementById('navLinks');
addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>40),{passive:true});
burger.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');burger.setAttribute('aria-expanded',open);});
navLinks.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>navLinks.classList.remove('open')));

// scroll reveals
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
window.qpObserveReveals=root=>root.querySelectorAll('.reveal').forEach(el=>io.observe(el));
