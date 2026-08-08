(function(){
  'use strict';
  const CHECKOUT='https://cadence.superwall.app/';
  const KEY='cadence_web_onboarding_v1';
  // Answers are stashed server-side before checkout so the app can skip
  // re-asking thirty questions. Publishable key only — this file is public.
  const STASH='https://tunpzyyedwrbdzurzsoh.supabase.co/functions/v1/web-onboarding-stash';
  const STASH_KEY='sb_publishable_AyMYLjjb1MwqVfJEe8gXEw_-60o8wOb';
  const state={step:0,answers:{days:['Mon','Tue','Wed','Thu','Fri'],time:'07:00'},signature:false};
  try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(_e){}
  const screen=document.getElementById('screen'),back=document.getElementById('back'),restart=document.getElementById('restart'),fill=document.getElementById('progressFill');
  const esc=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const name=()=>esc((state.answers.name||'').trim().split(/\s+/)[0]);
  const validEmail=v=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v||'').trim());
  const motivation=()=>state.answers.motivation||'Genuinely disciplined';
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
  const next=()=>{if(state.step<steps.length-1){state.step++;save();render();}};
  const choose=(key,value)=>{state.answers[key]=value;save();setTimeout(next,160);};
  const button=(label,id='next',disabled=false)=>`<button class="cta" id="${id}" ${disabled?'disabled':''}>${label}</button>`;
  const scaffold=(o,content='',actions='')=>`<div class="step ${o.center?'center':''}">${o.eyebrow?`<div class="eyebrow ${o.amber?'amber':''}">${o.eyebrow}</div>`:''}<h1>${o.title}${o.accent?`<span class="accent">${o.accent}</span>`:''}</h1>${o.subtitle?`<p class="subtitle">${o.subtitle}</p>`:''}<div class="content">${content}</div><div class="actions">${actions}</div></div>`;
  const options=(key,items)=>`<div class="options">${items.map(item=>{const pair=Array.isArray(item)?item:[item,''];return `<button class="option" data-key="${key}" data-value="${esc(pair[0])}">${pair[1]?`<span class="emoji">${pair[1]}</span>`:''}<span>${pair[0]}</span><span class="chev">›</span></button>`}).join('')}</div>`;
  const scene=emoji=>`<div class="scene" aria-hidden="true">${emoji}</div>`;
  const problem=(title,subtitle,emoji)=>()=>scaffold({title,subtitle},scene(emoji),button('Continue'));
  const feature=(eyebrow,title,subtitle,bad,good)=>()=>scaffold({eyebrow,title,subtitle},`<div class="compare"><div class="bad">✕ &nbsp; ${bad}</div><div class="good">✓ &nbsp; ${good}</div></div>`,button('Continue'));
  const howRow=(n,title,detail)=>`<div class="card how-row"><b>${n}</b><div><b>${title}</b><span>${detail}</span></div></div>`;
  const reviews=`<div class="card review"><div class="stars">★★★★★</div><h3>Such a great app</h3><p>Couldn't have asked for an easier, user-friendly app to track my training with!</p><small>LoganBety</small></div><div class="card review"><div class="stars">★★★★★</div><h3>Great app</h3><p>Very easy to use and helps me stay on track with my workout plan</p><small>Ant_10193</small></div>`;
  const research=(cards,foot)=>`<div class="research">${cards.map(c=>`<div class="card"><h3>${c[0]}</h3><p>${c[1]}</p></div>`).join('')}</div><p class="footnote">${foot}</p>`;
  const steps=[
    {id:'welcome',render:()=>scaffold({title:'Run first.',accent:'Win the day.',subtitle:'Cadence wakes you, locks your apps until you actually go, and hands the day back the moment you do.',center:true},`<div class="hero-art"><div class="orbit"></div><img src="images/app-icon.png" alt="Cadence"></div>`,button('Show me how'))},
    {id:'sex',render:()=>scaffold({title:'First, the basics',subtitle:'This tunes your paces and your plan.'},options('sex',['Male','Female']))},
    {id:'source',render:()=>scaffold({title:'Where did you hear about Cadence?',subtitle:'So we know who to thank.'},options('source',[['TikTok','♪'],['Instagram','◎'],['YouTube','▶'],['A friend or family','👥'],['The App Store',''],['Google or search','⌕'],['Somewhere else','…']]))},
    {id:'alarmNeed',render:()=>scaffold({title:"What's the first thing you do when you wake up?",subtitle:'Be honest. Everyone starts here.'},options('alarmNeed',['Reach for my phone','Hit snooze. Repeatedly','Lie there dreading the day','Get straight up']))},
    {id:'alarmNow',render:()=>scaffold({title:'How many mornings a week do you actually get up and move?'},options('alarmNow',['Basically none','One or two','Three or four','Most of them']))},
    {id:'struggle',render:()=>scaffold({title:"What's stopped you before?",subtitle:'The pattern matters more than the excuse.'},options('struggle',['I run out of willpower','Nobody holds me to it',"I'm too tired",'I start strong, then fade']))},
    {id:'motivation',render:()=>scaffold({title:'Who do you want to be in 90 days?'},options('motivation',['Genuinely disciplined','Fitter and stronger','Sharper and more focused','Unrecognisable']))},
    {id:'name',render:()=>scaffold({eyebrow:'YOUR NAME',title:'What should your coach call you?',subtitle:'This is who shows up tomorrow morning.'},`<input class="input" id="nameInput" value="${esc(state.answers.name)}" placeholder="Jordan" maxlength="40" autocomplete="given-name">`,button("That's me",'nameNext',!(state.answers.name||'').trim().length))},
    {id:'analyzing',auto:3500,render:()=>scaffold({title:'Building your analysis',subtitle:'Turning your answers into an accountability plan.',center:true},`<div class="loader"></div><div class="analysis-lines"><div class="on">Reading your answers…</div><div class="on">Scoring your accountability risk…</div><div class="on">Comparing you to thousands of runners…</div><div class="on">Preparing your results…</div></div>`)},
    {id:'analysis',render:()=>scaffold({eyebrow:'ANALYSIS COMPLETE',amber:true,title:name()?`${name()}, you're at high risk of skipping`:`You're at high risk of skipping`,subtitle:'Your answers match the pattern of failed running habits: good intentions, nothing enforcing them.',center:true},`<div class="card"><div class="risk-row"><div class="risk-label"><span>You</span><b>78%</b></div><div class="bar"><span style="width:78%"></span></div></div><div class="risk-row"><div class="risk-label"><span>The average runner</span><b>52%</b></div><div class="bar avg"><span style="width:52%"></span></div></div><p class="footnote">Tomorrow morning is your next fresh start.</p></div>`,button('Why this happens'))},
    {id:'willpower',render:problem("Motivation isn't the problem",'On the cold, dark morning, the people who quit running had plenty of motivation. What they were missing was something holding them to it.','🗓️')},
    {id:'mornings',render:problem('The hardest step is leaving the bed','Snooze, negotiate, roll over. The run never happens because nothing forces the first step — your feet never hit the floor.','🛏️')},
    {id:'scroll',render:problem('Your phone wins every morning',"One unlock and it's twenty minutes gone before your run. Instant rewards beat distant goals every single time.",'📱')},
    {id:'missed',render:problem('Skipped runs quietly erase progress','Miss two mornings and the streak fades faster than it builds — and the guilt makes it even harder to start again.','📉')},
    {id:'scienceMorning',render:()=>scaffold({eyebrow:'THE RESEARCH',title:'Why the morning',subtitle:"Cadence isn't built on a hunch about mornings. It's built on what researchers have found about fresh starts and getting the hard thing done early."},research([['Motivation rises after a fresh start','Wharton researchers found stronger goal pursuit after meaningful temporal landmarks.'],["Do it early and the day can't talk you out of it",'Early exercise tends to happen before the day’s demands accumulate.']], 'Fresh-start research looked at landmarks like weeks and birthdays. Treating every morning as one is our idea, not theirs.'),button('Continue'))},
    {id:'scienceBody',render:()=>scaffold({eyebrow:'THE RESEARCH',title:'What it does to you',subtitle:'Nobody can promise you a new body or a new brain. What the research does support is worth showing up for.'},research([['Morning activity is linked with lower average BMI and waist size','An observational Harvard-affiliated analysis found an association — not proof of cause.'],['Exercise supports cognition and mental well-being','Research supports a relationship with memory, cognition and mental well-being.']],"Then there's the part no study measures: every morning you finish is evidence of who you're becoming."),button('Continue'))},
    {id:'transformation',render:()=>scaffold({title:name()?`In 90 days, ${name()}, you won't recognise your mornings`:`In 90 days you won't recognise your mornings`,center:true},`<div class="card"><div class="projection"><div><strong>30</strong><span>days<br>average collapse</span></div><div>→</div><div><strong>180</strong><span>days<br>with Cadence</span></div></div><p class="chip">6× the streak</p></div>`,button('Unlock my transformation'))},
    {id:'proof',render:()=>scaffold({title:'Runners who stopped negotiating with themselves',subtitle:'Cadence removes the option to skip. Most runners turn a 10-minute morning into a habit they no longer think about.',center:true},`<div class="proof-grid"><div class="card"><strong>80%</strong><span>stay consistent<br>for a full year</span></div><div class="card"><strong>10 min</strong><span>the threshold to<br>unlock your day</span></div></div>`,button('Continue'))},
    {id:'featureAlarm',render:feature('THE ALARM','Never skip again','Set an alarm for whenever you run. Your distracting apps stay locked until you have moved.','Talk yourself out of it','The alarm decides, you just run')},
    {id:'featureCoach',render:feature('THE COACH','Know exactly how to run','Real guidance on pace, breathing and effort, tuned to you.','Guessing every run','A plan for every single morning')},
    {id:'featureGame',render:feature('THE GAME','Stay on track every day','Streaks, ranks and XP turn showing up into something you can see.','Fizzles out in a week','A streak you refuse to break')},
    {id:'reviews',render:()=>scaffold({title:"It's not motivation.",accent:"It's a system.",subtitle:'The reviews all say the same thing — it happens because skipping stopped being an option.'},reviews,button('Continue'))},
    {id:'days',render:()=>scaffold({eyebrow:'ALARM SCHEDULE',title:'Which days?',subtitle:'Pick 2 to 6 mornings. This is when Cadence wakes you up.'},`<div class="days">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<button class="day ${(state.answers.days||[]).includes(d)?'on':''}" data-day="${d}">${d.slice(0,1)}</button>`).join('')}</div><p class="small" id="dayCount">${(state.answers.days||[]).length} mornings selected</p>`,button('Continue','daysNext',!((state.answers.days||[]).length>=2&&(state.answers.days||[]).length<=6)))},
    {id:'time',render:()=>scaffold({eyebrow:'ALARM TIME',title:'What time do you run?',subtitle:'Early enough to win the morning. Late enough to be honest.'},`<input class="input time" id="timeInput" type="time" value="${state.answers.time||'07:00'}"><div class="card how-row" style="margin-top:18px"><b>⏰</b><div><b>Keep it consistent</b><span>A steady wake time — and daylight early — may help steady your body clock.</span></div></div>`,button('Continue'))},
    {id:'notifications',render:()=>scaffold({title:'Stay on track between runs',subtitle:'Cadence nudges you before your streak needs protecting — never after.',center:true},`<div class="scene" style="font-size:52px">🔔</div>`,button('Turn on notifications','notify')+'<button class="secondary" id="skip">Maybe later</button>')},
    {id:'how',render:()=>scaffold({title:'Three steps, every morning',subtitle:'This is the whole system. No settings to fiddle, no way out.'},`<div class="how">${howRow('1','Snap your shoes','Proof you are up. The camera checks, not your willpower.')}${howRow('2','Run your 10 minutes','Live GPS. No stopping until the minimum is banked.')}${howRow('3','Selfie to unlock','Sweaty and proud. Your apps open, your circle sees it.')}</div>`,button("Show me how it'll feel"))},
    {id:'ring',render:()=>scaffold({title:'Your run alarm is going off',subtitle:"This is what it sounds like when it's time to run. Silence it and photograph your shoes to begin."},`<div class="scene">⏰</div>`,`<div class="slide" id="slide"><i></i><span>Slide to silence →</span></div>`)},
    {id:'shoe',render:()=>scaffold({title:'Photograph your shoes',subtitle:'On your phone you would snap your running shoes here. We will simulate it for this demo.'},scene('👟'),button('Simulate shoe photo'))},
    {id:'run',render:()=>scaffold({title:'Run for 10 minutes',subtitle:'For real this is a live GPS run. Here is a sped up preview.'},`<div class="run-ring" id="runRing"><span id="runText">0:00</span></div>`,`<button class="cta" id="runNext" disabled>Simulating your run</button>`)},
    {id:'unlock',render:()=>scaffold({title:'Your apps unlock',subtitle:'The siren stops and every app opens the moment your run is done. Miss it, and they stay locked.'},`<div class="app-grid"><div class="app-icon">◎</div><div class="app-icon">♪</div><div class="app-icon">▶</div><div class="app-icon">💬</div></div>`,button('So what does that make me?'))},
    {id:'identity',render:()=>{const titles={'Genuinely disciplined':'Discipline is downstream of mornings','Fitter and stronger':'It starts before breakfast','Sharper and more focused':'Focus follows the first win','Unrecognisable':'Ninety days is enough'};return scaffold({eyebrow:"WHO YOU'RE BECOMING",title:titles[motivation()]||titles['Genuinely disciplined'],subtitle:"One won morning and the rest of the day opens up. That's the trade."},scene('🌅')+`<div class="card" style="margin-top:14px;text-align:left"><small class="eyebrow">YOU SAID YOU WANTED TO BE</small><h3 style="color:var(--lime)">${esc(motivation())}</h3><p class="small">Not one big decision — the one you keep making before anyone's awake.</p></div>`,button('Continue'));}},
    {id:'spillover',render:()=>scaffold({title:"It doesn't stop at the run",subtitle:'The run is the lever, not the point. What changes is everything the won morning touches.'},`<div class="how">${howRow('◎','Focus',"The hardest thing you'll do today is already behind you.")}${howRow('⚡','Energy',"Moving early beats the slump you'd have spent the morning in.")}${howRow('◆','Discipline','One thing you never negotiate teaches you that you can hold others.')}${howRow('☀','Mood','You start the day having kept a promise to yourself.')}</div>`,button('Continue'))},
    {id:'invest',auto:4700,render:()=>scaffold({title:'Your system starts now',center:true},`<div><p class="typed">It takes 66 days to build a habit.</p><p class="typed">It takes 120 days to build a system.</p><p class="typed">Now it's time to invest in yourself${name()?`, ${name()}`:''}.</p></div>`)},
    {id:'commit',render:()=>scaffold({title:'Make it a promise',subtitle:'Sign the pledge to commit.',center:true},`<div class="card pledge"><div class="eyebrow">${name()?`${name().toUpperCase()}'S`:'MY'} CADENCE PLAN</div><div class="pledge-line">When the alarm goes off, I get up. That decision is already made.</div><div class="pledge-line">I'll let becoming ${esc(motivation().toLowerCase())} be a process, not one good day.</div><div class="pledge-line">I'll be honest about the mornings I miss, and start again the next one.</div><div class="pledge-line">When I want to quit, I do the ten minutes first — then decide.</div><div class="signature-wrap"><div class="signature-head"><span>Sign here</span><button class="clear" id="clearSig">Clear</button></div><canvas id="signature" width="640" height="260"></canvas></div></div>`,button('I commit','commitNext',!state.signature)+`<p class="legal">A pledge, not a contract. You can change your goals anytime.</p>`)},
    // Sits between the pledge and checkout, where the runner is already reaching
    // for a card. Framed as delivery rather than signup because that is exactly
    // what it is: the activation link is how Cadence gets unlocked on the phone,
    // and this address is also the key the app uses to find these answers again.
    {id:'email',render:()=>scaffold({eyebrow:'ONE LAST THING',title:'Where should we send your activation link?',subtitle:'You need it to unlock Cadence on your phone after checkout.'},`<input class="input" id="emailInput" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="${esc(state.answers.email)}" placeholder="you@email.com" maxlength="254">`,button('Continue to checkout','emailNext',!validEmail(state.answers.email))+`<p class="legal">We use this to send your activation link and receipt. Your plan is saved to it so you don't answer these questions twice.</p>`)},
  ];
  // Saves the answers so the app can claim them after the runner pays. Returns
  // the stash id, or null if anything went wrong — a failure here must never
  // cost a sale, so every path resolves rather than throws.
  function stash(){
    const a=state.answers;
    if(!validEmail(a.email))return Promise.resolve(null);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),3000);
    return fetch(STASH,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':STASH_KEY,'Authorization':'Bearer '+STASH_KEY},
      body:JSON.stringify({
        email:a.email,
        answers:{name:a.name||'',sex:a.sex||'',source:a.source||'',alarmNeed:a.alarmNeed||'',alarmNow:a.alarmNow||'',struggle:a.struggle||'',motivation:a.motivation||''},
        signed:!!state.signature,
        alarm_days:a.days||[],
        alarm_time:a.time||'07:00'
      }),
      signal:controller.signal
    }).then(r=>r.ok?r.json():null).then(d=>(d&&d.id)||null).catch(()=>null).finally(()=>clearTimeout(timer));
  }
  function checkout(){
    const btn=document.getElementById('emailNext');
    if(btn){btn.disabled=true;btn.textContent='Saving your plan…';}
    stash().then(id=>{
      const url=new URL(CHECKOUT),incoming=new URLSearchParams(location.search);
      incoming.forEach((v,k)=>url.searchParams.set(k,v));
      url.searchParams.set('name',state.answers.name||'');
      url.searchParams.set('email',state.answers.email||'');
      url.searchParams.set('onboarding','complete');
      url.searchParams.set('alarm_days',(state.answers.days||[]).join(','));
      url.searchParams.set('alarm_time',state.answers.time||'07:00');
      // Fast path for the app: if Superwall preserves this through redemption,
      // the claim skips the email lookup entirely.
      if(id)url.searchParams.set('onb',id);
      // Only forget the answers once they are safely stored somewhere else.
      // Clearing unconditionally is what used to make the loss permanent.
      if(id)localStorage.removeItem(KEY);
      location.assign(url.toString());
    });
  }
  function wire(){
    screen.querySelectorAll('.option').forEach(el=>el.addEventListener('click',()=>choose(el.dataset.key,el.dataset.value)));
    const n=document.getElementById('next');if(n)n.onclick=next;
    const ni=document.getElementById('nameInput'),nn=document.getElementById('nameNext');if(ni){ni.focus();ni.oninput=()=>{state.answers.name=ni.value;save();nn.disabled=!ni.value.trim();};nn.onclick=()=>{if(ni.value.trim()){state.answers.name=ni.value.trim();next();}};ni.onkeydown=e=>{if(e.key==='Enter'&&ni.value.trim())nn.click();};}
    document.querySelectorAll('[data-day]').forEach(el=>el.onclick=()=>{const d=el.dataset.day,a=state.answers.days||[];state.answers.days=a.includes(d)?a.filter(x=>x!==d):a.concat(d);save();render();});const dn=document.getElementById('daysNext');if(dn)dn.onclick=next;
    const ti=document.getElementById('timeInput');if(ti){ti.onchange=()=>{state.answers.time=ti.value;save();};document.getElementById('next').onclick=()=>{state.answers.time=ti.value;next();};}
    // No Notification.requestPermission() here on purpose. A granted web push
    // permission does nothing for the iOS app, and spending the runner's "yes"
    // on a prompt that grants nothing makes the real in-app ask harder. This
    // screen is now purely a priming beat for the prompt the app will show.
    const notify=document.getElementById('notify'),skip=document.getElementById('skip');if(notify)notify.onclick=next;if(skip)skip.onclick=next;
    const ei=document.getElementById('emailInput'),en=document.getElementById('emailNext');if(ei){ei.focus();ei.oninput=()=>{state.answers.email=ei.value.trim();save();en.disabled=!validEmail(state.answers.email);};en.onclick=()=>{if(validEmail(ei.value))checkout();};ei.onkeydown=e=>{if(e.key==='Enter'&&validEmail(ei.value))en.click();};}
    const slide=document.getElementById('slide');if(slide){let start=0;slide.onpointerdown=e=>{start=e.clientX;slide.setPointerCapture(e.pointerId)};slide.onpointerup=e=>{if(e.clientX-start>80)next();};slide.onclick=()=>next();}
    const ring=document.getElementById('runRing');if(ring){let p=0;const timer=setInterval(()=>{if(state.step!==steps.findIndex(s=>s.id==='run'))return clearInterval(timer);p+=2;ring.style.setProperty('--run',p+'%');document.getElementById('runText').textContent=Math.min(10,Math.floor(p/10))+':00';if(p>=100){clearInterval(timer);const b=document.getElementById('runNext');b.disabled=false;b.textContent='See what happens';b.onclick=next;}},100);}
    const canvas=document.getElementById('signature');if(canvas){const ctx=canvas.getContext('2d');ctx.strokeStyle='#17301b';ctx.lineWidth=5;ctx.lineCap='round';let drawing=false;const pt=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};canvas.onpointerdown=e=>{drawing=true;const p=pt(e);ctx.beginPath();ctx.moveTo(p.x,p.y);canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drawing)return;const p=pt(e);ctx.lineTo(p.x,p.y);ctx.stroke();state.signature=true;document.getElementById('commitNext').disabled=false;save();};canvas.onpointerup=()=>drawing=false;document.getElementById('clearSig').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);state.signature=false;save();document.getElementById('commitNext').disabled=true;};document.getElementById('commitNext').onclick=next;}
  }
  let autoTimer;
  function render(){clearTimeout(autoTimer);state.step=Math.max(0,Math.min(state.step,steps.length-1));const step=steps[state.step];fill.style.width=`${(state.step/(steps.length-1))*100}%`;back.disabled=state.step===0;screen.innerHTML=step.render();wire();if(step.auto)autoTimer=setTimeout(next,step.auto);window.scrollTo(0,0);}
  back.onclick=()=>{if(state.step>0){state.step--;save();render();}};
  restart.onclick=()=>{if(confirm('Restart Cadence onboarding?')){localStorage.removeItem(KEY);state.step=0;state.answers={days:['Mon','Tue','Wed','Thu','Fri'],time:'07:00'};state.signature=false;render();}};
  render();
})();
