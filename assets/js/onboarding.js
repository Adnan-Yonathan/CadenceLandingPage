(function(){
  'use strict';
  const CHECKOUT='https://cadence.superwall.app/';
  // Promo codes map to their own checkout link, one per discount.
  //
  // Superwall's hosted checkout does not set `allow_promotion_codes`, so a
  // Stripe promotion code typed on their checkout page has nothing to bind to.
  // Their model is a discounted product behind its own placement, which is what
  // these links are. Add an entry per discount as the placements are created:
  //
  //   FRIEND50: 'https://cadence.superwall.app/friend50',
  //
  // Keys are compared upper-cased and trimmed, so the runner's capitalisation
  // and stray spaces don't decide whether they get their discount.
  const PROMO_LINKS={};
  const promoLink=code=>PROMO_LINKS[String(code||'').trim().toUpperCase()]||null;
  const KEY='cadence_web_onboarding_v1';
  // Answers are stashed server-side before checkout so the app can skip
  // re-asking thirty questions. Publishable key only — this file is public.
  const STASH='https://tunpzyyedwrbdzurzsoh.supabase.co/functions/v1/web-onboarding-stash';
  const STASH_KEY='sb_publishable_AyMYLjjb1MwqVfJEe8gXEw_-60o8wOb';
  // Supabase's hosted OAuth entry point. Used directly rather than pulling in
  // supabase-js: all we need is the redirect and the email claim off the
  // returned token, and this file has no build step or dependencies.
  const AUTHORIZE='https://tunpzyyedwrbdzurzsoh.supabase.co/auth/v1/authorize';
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state={step:0,answers:{},signature:false};
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
  const scene=icon=>`<div class="scene" aria-hidden="true">${svg(icon,'art')}</div>`;
  const problem=(title,subtitle,icon)=>()=>scaffold({title,subtitle},scene(icon),button('Continue'));
  const feature=(eyebrow,title,subtitle,bad,good)=>()=>scaffold({eyebrow,title,subtitle},`<div class="compare"><div class="bad">✕ &nbsp; ${bad}</div><div class="good">✓ &nbsp; ${good}</div></div>`,button('Continue'));
  const howRow=(n,title,detail)=>`<div class="card how-row"><b>${n}</b><div><b>${title}</b><span>${detail}</span></div></div>`;
  const reviews=`<div class="card review"><div class="stars">★★★★★</div><h3>Such a great app</h3><p>Couldn't have asked for an easier, user-friendly app to track my training with!</p><small>LoganBety</small></div><div class="card review"><div class="stars">★★★★★</div><h3>Great app</h3><p>Very easy to use and helps me stay on track with my workout plan</p><small>Ant_10193</small></div>`;
  const research=(cards,foot)=>`<div class="research">${cards.map(c=>`<div class="card"><h3>${c[0]}</h3><p>${c[1]}</p></div>`).join('')}</div><p class="footnote">${foot}</p>`;
  const svg=(path,cls)=>`<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;
  const LOCK='M7 10V7a5 5 0 0110 0v3h1a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h1zm2 0h6V7a3 3 0 00-6 0v3z';
  const UNLOCK='M7 10V7a5 5 0 019.6-2l-1.9.8A3 3 0 009 7v3h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h1z';
  const CLOCK='M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v5.4l3.6 2.1-1 1.7L11 13V7h2z';
  const APPLE='M16.36 12.78c.02 2.6 2.28 3.47 2.3 3.48-.02.06-.36 1.24-1.19 2.46-.72 1.05-1.46 2.1-2.63 2.12-1.15.02-1.52-.68-2.83-.68-1.32 0-1.73.66-2.82.7-1.13.04-1.99-1.13-2.71-2.18-1.48-2.14-2.61-6.05-1.09-8.69.75-1.31 2.1-2.14 3.56-2.16 1.11-.02 2.16.75 2.84.75.68 0 1.95-.92 3.29-.79.56.02 2.13.23 3.14 1.7-.08.05-1.87 1.1-1.86 3.29zM14.2 4.6c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.55 1.31-.56.65-1.05 1.68-.92 2.68.97.07 1.96-.49 2.57-1.23z';
  // Drawn icons, not emoji. Emoji render as a different typeface on every
  // platform and at a weight nothing else here uses, which is exactly why the
  // funnel stopped looking like the app. These inherit `currentColor` and sit
  // on the same 24-unit grid as the tile glyphs above.
  const ICON={
    calendar:'M7 2h2v2h6V2h2v2h2a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h2V2zM5 9v11h14V9H5z',
    bed:'M3 6h2v6h6V9h7a4 4 0 014 4v6h-2v-3H5v3H3V6zm4.5 1.5a2.25 2.25 0 110 4.5 2.25 2.25 0 010-4.5z',
    phone:'M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm3 1.5v1h4v-1h-4zM7 6v12h10V6H7z',
    decline:'M3 3h2v16h16v2H3V3zm18 5v6h-2v-2.6l-4.5 4.5-4-4L7.4 16 6 14.6l5.5-5.5 4 4L18.4 10H16V8h5z',
    alarm:'M12 4a8 8 0 110 16 8 8 0 010-16zm1 3h-2v5.4l3.6 2.1 1-1.7L13 11.2V7zM5.3 2.3l1.4 1.4L3.4 7 2 5.6l3.3-3.3zm13.4 0L22 5.6 20.6 7l-3.3-3.3 1.4-1.4z',
    shoe:'M2 13h2.5l2.2-2.8 1.6 1.2-1.4 1.6H10l1.8-2.2 1.6 1.3L12.2 13H15l3.6 1.4c1.5.6 2.4 1.5 2.4 3V19a1 1 0 01-1 1H3a1 1 0 01-1-1v-6z',
    sunrise:'M11 2h2v3h-2V2zM4.2 4.9l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zm14.2-1.4l1.4 1.4-2.1 2.1-1.4-1.4 2.1-2.1zM12 8a5 5 0 015 5H7a5 5 0 015-5zM2 15h20v2H2v-2zm3 3h14v2H5v-2z',
    target:'M12 2a10 10 0 110 20 10 10 0 010-20zm0 3a7 7 0 100 14 7 7 0 000-14zm0 3.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z',
    bolt:'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
    shield:'M12 2l9 4v6c0 5-3.8 9.3-9 10-5.2-.7-9-5-9-10V6l9-4z',
    smile:'M12 2a10 10 0 110 20 10 10 0 010-20zM8.5 9a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm7 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM7 14a5 5 0 0010 0H7z',
    doc:'M6 2h8l6 6v14H6a2 2 0 01-2-2V4a2 2 0 012-2zm7 1.5V9h5.5L13 3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2z',
    refresh:'M12 4V1L8 5l4 4V6a6 6 0 11-6 6H4a8 8 0 108-8z',
    people:'M9 11a4 4 0 110-8 4 4 0 010 8zm7 0a3 3 0 110-6 3 3 0 010 6zM1 20a8 8 0 0116 0H1zm16.5 0c0-2-.7-3.9-1.9-5.4A6 6 0 0123 20h-5.5z',
    search:'M10 2a8 8 0 106.3 12.9l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z',
    dots:'M5 10a2 2 0 110 4 2 2 0 010-4zm7 0a2 2 0 110 4 2 2 0 010-4zm7 0a2 2 0 110 4 2 2 0 010-4z',
  };
  // The nine apps behind the shield, mirroring `OnbAppTile.grid`. As in the app,
  // the brand *colour* does the recognising next to a generic glyph — shipping
  // real logos would mean bundling trademarked artwork.
  const TILES=[
    ['#C1348A','#fff','M9 4l-1.5 2H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-3.5L15 4H9zm3 5a5 5 0 110 10 5 5 0 010-10z'],
    ['#0B0B0B','#fff','M9 18a3 3 0 11-2-2.83V5l11-2v10.17A3 3 0 1118 16V7.5L9 9.3V18z'],
    ['#E21B1B','#fff','M8 5v14l11-7z'],
    // Silhouette alone reads as a blob at 18px, so the d-pad and button carry it.
    ['#7B3FE4','#fff','M17 6H7a5 5 0 00-5 5v4a3 3 0 005.6 1.5L9 14h6l1.4 2.5A3 3 0 0022 15v-4a5 5 0 00-5-5zM8.25 8.5h1.5V10h1.5v1.5h-1.5V13h-1.5v-1.5h-1.5V10h1.5V8.5zM16 8.75a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z'],
    ['#16181C','#fff','M4 4h16a2 2 0 012 2v9a2 2 0 01-2 2h-8l-6 4v-4H4a2 2 0 01-2-2V6a2 2 0 012-2z'],
    ['#E8622C','#fff','M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm3 3.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm8 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-8 8a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm8 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-4-4a1.5 1.5 0 100 3 1.5 1.5 0 000-3z'],
    ['#F5D90A','#16281A','M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm16 0h2v6h-6v-2h4v-4zM12 8a4 4 0 110 8 4 4 0 010-8z'],
    ['#2AABEE','#fff','M22 2L2 10l7 3 3 7 10-18z'],
    ['#B5121B','#fff','M3 4h18v16H3V4zm2 2v2h2V6H5zm12 0v2h2V6h-2zM5 10v4h14v-4H5zm0 6v2h2v-2H5zm12 0v2h2v-2h-2z'],
  ];
  const tileGrid=()=>`<div class="tiles">${TILES.map(t=>`<span class="tile" style="--bg:${t[0]};--fg:${t[1]}">${svg(LOCK,'shield')}${svg(t[2],'glyph')}</span>`).join('')}</div>`;
  // Chapters, ported from `chapter(for:)` in OnboardingFlow.swift. The bar
  // belongs to the CURRENT chapter, fills across it, and starts over when the
  // next one begins — so the total length of the flow is never on display.
  // Every chapter must be a contiguous run of `steps`; `assertChapters` holds
  // that invariant, exactly as the app's ordering does.
  const CHAPTERS=[
    ['quiz',['welcome','sex','source','alarmNeed','alarmNow','struggle','motivation','name']],
    ['analysis',['analyzing','analysis']],
    ['problems',['willpower','mornings','scroll','missed']],
    ['solutions',['scienceMorning','scienceBody','transformation','proof','featureAlarm','featureCoach','featureGame','reviews']],
    // No `personalize` chapter. Alarm days, alarm time and the notification
    // prime all moved into the app: the web funnel can't set an alarm or grant
    // a notification permission, so asking here spent the runner's patience on
    // answers the app has to collect again anyway.
    ['reveal',['how','ring','shoe','run','unlock','identity','spillover','invest','commit','signIn','promo']],
  ];
  const chapterOf=id=>{const c=CHAPTERS.find(c=>c[1].indexOf(id)>=0);return c?c[0]:'reveal';};
  // A step that slips into the wrong chapter silently produces a bar that jumps
  // or never fills, so fail loudly in the console rather than shipping it.
  function assertChapters(){
    const seen=[];
    steps.forEach(s=>{const c=chapterOf(s.id);if(seen[seen.length-1]!==c)seen.push(c);});
    const dupes=seen.filter((c,i)=>seen.indexOf(c)!==i);
    if(dupes.length)console.warn('Onboarding chapters are not contiguous:',dupes);
    steps.forEach(s=>{if(!CHAPTERS.some(c=>c[1].indexOf(s.id)>=0))console.warn('Step has no chapter:',s.id);});
  }
  // Progress within the current chapter. 1-based, and fills to 100% on the
  // chapter's last step so finishing one feels earned.
  function chapterProgress(){
    const here=chapterOf(steps[state.step].id);
    const within=steps.filter(s=>chapterOf(s.id)===here);
    const i=within.findIndex(s=>s.id===steps[state.step].id);
    return ((i<0?0:i)+1)/Math.max(within.length,1);
  }
  const steps=[
    {id:'welcome',render:()=>scaffold({title:'Run first.',accent:'Win the day.',subtitle:'Cadence wakes you, locks your apps until you actually go, and hands the day back the moment you do.',center:true},
      `<div class="mock" id="mock">`+
      `<div class="mockchip">${svg(CLOCK,'shut')}${svg(UNLOCK,'open')}<b id="mockChip">Run to unlock</b></div>`+
      tileGrid()+
      `<div class="mockbar"><span></span></div>`+
      `<div class="mocklabel" id="mockLabel">10 minutes to unlock</div>`+
      `</div>`,
      button('Show me how')+`<button class="linkbtn" id="haveMembership">Already have a membership? Sign in</button>`)},
    {id:'sex',render:()=>scaffold({title:'First, the basics',subtitle:'This tunes your paces and your plan.'},options('sex',['Male','Female']))},
    {id:'source',render:()=>scaffold({title:'Where did you hear about Cadence?',subtitle:'So we know who to thank.'},options('source',[['TikTok',svg(TILES[1][2],'')],['Instagram',svg(TILES[0][2],'')],['YouTube',svg(TILES[2][2],'')],['A friend or family',svg(ICON.people,'')],['The App Store',svg(APPLE,'')],['Google or search',svg(ICON.search,'')],['Somewhere else',svg(ICON.dots,'')]]))},
    {id:'alarmNeed',render:()=>scaffold({title:"What's the first thing you do when you wake up?",subtitle:'Be honest. Everyone starts here.'},options('alarmNeed',['Reach for my phone','Hit snooze. Repeatedly','Lie there dreading the day','Get straight up']))},
    {id:'alarmNow',render:()=>scaffold({title:'How many mornings a week do you actually get up and move?'},options('alarmNow',['Basically none','One or two','Three or four','Most of them']))},
    {id:'struggle',render:()=>scaffold({title:"What's stopped you before?",subtitle:'The pattern matters more than the excuse.'},options('struggle',['I run out of willpower','Nobody holds me to it',"I'm too tired",'I start strong, then fade']))},
    {id:'motivation',render:()=>scaffold({title:'Who do you want to be in 90 days?'},options('motivation',['Genuinely disciplined','Fitter and stronger','Sharper and more focused','Unrecognisable']))},
    {id:'name',render:()=>scaffold({eyebrow:'YOUR NAME',title:'What should your coach call you?',subtitle:'This is who shows up tomorrow morning.'},`<input class="input" id="nameInput" value="${esc(state.answers.name)}" placeholder="Jordan" maxlength="40" autocomplete="given-name">`,button("That's me",'nameNext',!(state.answers.name||'').trim().length))},
    {id:'analyzing',auto:3500,render:()=>scaffold({title:'Building your analysis',subtitle:'Turning your answers into an accountability plan.',center:true},`<div class="loader"></div><div class="analysis-lines"><div class="on">Reading your answers…</div><div class="on">Scoring your accountability risk…</div><div class="on">Comparing you to thousands of runners…</div><div class="on">Preparing your results…</div></div>`)},
    {id:'analysis',render:()=>scaffold({eyebrow:'ANALYSIS COMPLETE',amber:true,title:name()?`${name()}, you're at high risk of skipping`:`You're at high risk of skipping`,subtitle:'Your answers match the pattern of failed running habits: good intentions, nothing enforcing them.',center:true},`<div class="card"><div class="risk-row"><div class="risk-label"><span>You</span><b>78%</b></div><div class="bar"><span style="width:78%"></span></div></div><div class="risk-row"><div class="risk-label"><span>The average runner</span><b>52%</b></div><div class="bar avg"><span style="width:52%"></span></div></div><p class="footnote">Tomorrow morning is your next fresh start.</p></div>`,button('Why this happens'))},
    {id:'willpower',render:problem("Motivation isn't the problem",'On the cold, dark morning, the people who quit running had plenty of motivation. What they were missing was something holding them to it.',ICON.calendar)},
    {id:'mornings',render:problem('The hardest step is leaving the bed','Snooze, negotiate, roll over. The run never happens because nothing forces the first step — your feet never hit the floor.',ICON.bed)},
    {id:'scroll',render:problem('Your phone wins every morning',"One unlock and it's twenty minutes gone before your run. Instant rewards beat distant goals every single time.",ICON.phone)},
    {id:'missed',render:problem('Skipped runs quietly erase progress','Miss two mornings and the streak fades faster than it builds — and the guilt makes it even harder to start again.',ICON.decline)},
    {id:'scienceMorning',render:()=>scaffold({eyebrow:'THE RESEARCH',title:'Why the morning',subtitle:"Cadence isn't built on a hunch about mornings. It's built on what researchers have found about fresh starts and getting the hard thing done early."},research([['Motivation rises after a fresh start','Wharton researchers found stronger goal pursuit after meaningful temporal landmarks.'],["Do it early and the day can't talk you out of it",'Early exercise tends to happen before the day’s demands accumulate.']], 'Fresh-start research looked at landmarks like weeks and birthdays. Treating every morning as one is our idea, not theirs.'),button('Continue'))},
    {id:'scienceBody',render:()=>scaffold({eyebrow:'THE RESEARCH',title:'What it does to you',subtitle:'Nobody can promise you a new body or a new brain. What the research does support is worth showing up for.'},research([['Morning activity is linked with lower average BMI and waist size','An observational Harvard-affiliated analysis found an association — not proof of cause.'],['Exercise supports cognition and mental well-being','Research supports a relationship with memory, cognition and mental well-being.']],"Then there's the part no study measures: every morning you finish is evidence of who you're becoming."),button('Continue'))},
    {id:'transformation',render:()=>scaffold({title:name()?`In 90 days, ${name()}, you won't recognise your mornings`:`In 90 days you won't recognise your mornings`,center:true},`<div class="card"><div class="projection"><div><strong>30</strong><span>days<br>average collapse</span></div><div>→</div><div><strong>180</strong><span>days<br>with Cadence</span></div></div><p class="chip">6× the streak</p></div>`,button('Unlock my transformation'))},
    {id:'proof',render:()=>scaffold({title:'Runners who stopped negotiating with themselves',subtitle:'Cadence removes the option to skip. Most runners turn a 10-minute morning into a habit they no longer think about.',center:true},`<div class="proof-grid"><div class="card"><strong>80%</strong><span>stay consistent<br>for a full year</span></div><div class="card"><strong>10 min</strong><span>the threshold to<br>unlock your day</span></div></div>`,button('Continue'))},
    {id:'featureAlarm',render:feature('THE ALARM','Never skip again','Set an alarm for whenever you run. Your distracting apps stay locked until you have moved.','Talk yourself out of it','The alarm decides, you just run')},
    {id:'featureCoach',render:feature('THE COACH','Know exactly how to run','Real guidance on pace, breathing and effort, tuned to you.','Guessing every run','A plan for every single morning')},
    {id:'featureGame',render:feature('THE GAME','Stay on track every day','Streaks, ranks and XP turn showing up into something you can see.','Fizzles out in a week','A streak you refuse to break')},
    {id:'reviews',render:()=>scaffold({title:"It's not motivation.",accent:"It's a system.",subtitle:'The reviews all say the same thing — it happens because skipping stopped being an option.'},reviews,button('Continue'))},
    {id:'how',render:()=>scaffold({title:'Three steps, every morning',subtitle:'This is the whole system. No settings to fiddle, no way out.'},`<div class="how">${howRow('1','Snap your shoes','Proof you are up. The camera checks, not your willpower.')}${howRow('2','Run your 10 minutes','Live GPS. No stopping until the minimum is banked.')}${howRow('3','Selfie to unlock','Sweaty and proud. Your apps open, your circle sees it.')}</div>`,button("Show me how it'll feel"))},
    {id:'ring',render:()=>scaffold({title:'Your run alarm is going off',subtitle:"This is what it sounds like when it's time to run. Silence it and photograph your shoes to begin."},scene(ICON.alarm),`<div class="slide" id="slide"><i></i><span>Slide to silence →</span></div>`)},
    {id:'shoe',render:()=>scaffold({title:'Photograph your shoes',subtitle:'On your phone you would snap your running shoes here. We will simulate it for this demo.'},scene(ICON.shoe),button('Simulate shoe photo'))},
    {id:'run',render:()=>scaffold({title:'Run for 10 minutes',subtitle:'For real this is a live GPS run. Here is a sped up preview.'},`<div class="run-ring" id="runRing"><span id="runText">0:00</span></div>`,`<button class="cta" id="runNext" disabled>Simulating your run</button>`)},
    {id:'unlock',render:()=>scaffold({title:'Your apps unlock',subtitle:'The siren stops and every app opens the moment your run is done. Miss it, and they stay locked.'},`<div class="mock plain" id="unlockMock">`+tileGrid()+`</div>`,button('So what does that make me?'))},
    {id:'identity',render:()=>{const titles={'Genuinely disciplined':'Discipline is downstream of mornings','Fitter and stronger':'It starts before breakfast','Sharper and more focused':'Focus follows the first win','Unrecognisable':'Ninety days is enough'};return scaffold({eyebrow:"WHO YOU'RE BECOMING",title:titles[motivation()]||titles['Genuinely disciplined'],subtitle:"One won morning and the rest of the day opens up. That's the trade."},scene(ICON.sunrise)+`<div class="card" style="margin-top:14px;text-align:left"><small class="eyebrow">YOU SAID YOU WANTED TO BE</small><h3 style="color:var(--lime)">${esc(motivation())}</h3><p class="small">Not one big decision — the one you keep making before anyone's awake.</p></div>`,button('Continue'));}},
    {id:'spillover',render:()=>scaffold({title:"It doesn't stop at the run",subtitle:'The run is the lever, not the point. What changes is everything the won morning touches.'},`<div class="how">${howRow(svg(ICON.target,''),'Focus',"The hardest thing you'll do today is already behind you.")}${howRow(svg(ICON.bolt,''),'Energy',"Moving early beats the slump you'd have spent the morning in.")}${howRow(svg(ICON.shield,''),'Discipline','One thing you never negotiate teaches you that you can hold others.')}${howRow(svg(ICON.smile,''),'Mood','You start the day having kept a promise to yourself.')}</div>`,button('Continue'))},
    {id:'invest',auto:4700,render:()=>scaffold({title:'Your system starts now',center:true},`<div><p class="typed">It takes 66 days to build a habit.</p><p class="typed">It takes 120 days to build a system.</p><p class="typed">Now it's time to invest in yourself${name()?`, ${name()}`:''}.</p></div>`)},
    {id:'commit',render:()=>scaffold({title:'Make it a promise',subtitle:'Sign the pledge to commit.',center:true},`<div class="card pledge"><div class="eyebrow">${name()?`${name().toUpperCase()}'S`:'MY'} CADENCE PLAN</div><div class="pledge-line">When the alarm goes off, I get up. That decision is already made.</div><div class="pledge-line">I'll let becoming ${esc(motivation().toLowerCase())} be a process, not one good day.</div><div class="pledge-line">I'll be honest about the mornings I miss, and start again the next one.</div><div class="pledge-line">When I want to quit, I do the ten minutes first — then decide.</div><div class="signature-wrap"><div class="signature-head"><span>Sign here</span><button class="clear" id="clearSig">Clear</button></div><canvas id="signature" width="640" height="260"></canvas></div></div>`,button('I commit','commitNext',!state.signature)+`<p class="legal">A pledge, not a contract. You can change your goals anytime.</p>`)},
    // Sits between the pledge and checkout, where the runner is already reaching
    // for a card. Framed as delivery rather than signup because that is exactly
    // what it is: the activation link is how Cadence gets unlocked on the phone,
    // and this address is also the key the app uses to find these answers again.
    // Mirrors `Phase.signIn` in the app, which sits at exactly this point for
    // the same reason: it binds the purchase to a real account at the moment of
    // sale rather than after it. Apple also fixes the join that plain email
    // couldn't — a runner who picks Hide My Email gets the SAME relay address
    // here and in the app, because the relay is per Apple ID per team, so
    // `web-onboarding-claim` still finds these answers.
    // Apple is the ONLY way through. There is deliberately no email path: an
    // emailed activation link is a second thing to lose, and Apple identity is
    // what lets the app find these answers again — including under Hide My
    // Email, where the relay address is stable per Apple ID per team.
    {id:'signIn',render:()=>scaffold(
      {eyebrow:'ONE LAST THING',title:'Save your plan to your account',subtitle:'Sign in once and Cadence unlocks on your phone the moment you pay — with every answer you just gave already in place.'},
      `${state.authError?`<div class="notice">That sign-in didn't finish. Nothing was charged and your answers are safe — tap to try again.</div>`:''}<div class="how">${howRow(svg(ICON.doc,''),'Your plan carries over',"The thirty questions you just answered are waiting in the app.")}${howRow(svg(ICON.refresh,''),'Nothing to dig out of your inbox','Signing in on your phone is what unlocks it — no activation link to lose.')}</div>`,
      `<button class="apple" id="appleBtn">${svg(APPLE,'')}<span>${state.authError?'Try Sign in with Apple again':'Sign in with Apple'}</span></button>`)},
    // Sits between sign-in and checkout, where someone holding a code expects to
    // be asked for it. Skippable and never blocking: an unrecognised code shows
    // an inline error, and continuing without one goes to full price.
    {id:'promo',render:()=>scaffold(
      {eyebrow:'DISCOUNT',title:'Have a promo code?',subtitle:'Enter it now and your discount is applied at checkout. No code is fine — skip straight through.'},
      `${state.promoError?`<div class="notice">We don't recognise that code. Check it and try again, or skip — you can still subscribe at the normal price.</div>`:''}<input class="input" id="promoInput" value="${esc(state.answers.promo)}" placeholder="CADENCE20" maxlength="40" autocapitalize="characters" autocomplete="off" spellcheck="false">`,
      button('Apply and continue','promoNext')+`<button class="linkbtn" id="promoSkip">I don't have a code</button>`)},
  ];
  // Hands off to Supabase's hosted Apple flow and comes back to this page.
  // `state` is already in localStorage, so the runner returns to this same step.
  //
  // Preflighted on purpose. A misconfigured provider does NOT redirect back with
  // `#error` — Supabase answers the authorize URL with a raw JSON body, so
  // navigating blindly dumps the runner on a supabase.co error page with no way
  // back and no sale. Asking first costs one request and keeps them on the page.
  function appleSignIn(){
    save();
    const btn=document.getElementById('appleBtn');
    if(btn){btn.disabled=true;btn.textContent='Contacting Apple…';}
    const back=location.origin+location.pathname+location.search;
    const url=AUTHORIZE+'?provider=apple&redirect_to='+encodeURIComponent(back);
    const go=()=>location.assign(url);
    fetch(url,{redirect:'manual'}).then(r=>{
      // A working provider answers 3xx, which `manual` surfaces as an opaque
      // redirect we deliberately don't follow — the real navigation does that.
      if(r.type==='opaqueredirect'||r.status===0||(r.status>=300&&r.status<400))return go();
      return r.json().catch(()=>({})).then(e=>{
        console.warn('Apple sign-in unavailable:',e&&e.msg||r.status);
        state.authError=true;save();render();
      });
    // A network blip shouldn't block a runner from a provider that works.
    }).catch(go);
  }
  /// The email claim off the returned access token. Read for its address only —
  /// never for authorisation — so decoding without verifying is safe here: the
  /// stash endpoint is public and email-keyed either way.
  function tokenEmail(token){
    try{
      const part=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const bytes=Uint8Array.from(atob(part+'=='.slice(0,(4-part.length%4)%4)),c=>c.charCodeAt(0));
      const email=JSON.parse(new TextDecoder().decode(bytes)).email;
      return validEmail(email)?String(email).trim().toLowerCase():null;
    }catch(_e){return null;}
  }
  /// Handles the return leg of the Apple redirect. Returns 'ok' when we came
  /// back with an address, 'retry' when Apple didn't work out, or false when
  /// this is an ordinary page load.
  function consumeAuthRedirect(){
    const hash=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
    const query=new URLSearchParams(location.search);
    const token=hash.get('access_token');
    const failed=hash.get('error')||query.get('error');
    if(!token&&!failed)return false;
    // Strip the token out of the address bar before anything else renders, but
    // keep the query: `checkout` forwards those attribution params to Superwall,
    // and dropping them here would silently lose the source of every Apple sale.
    history.replaceState(null,'',location.pathname+location.search);
    if(token){
      const email=tokenEmail(token);
      if(email){state.answers.email=email;state.appleSignedIn=true;save();return 'ok';}
    }
    // Apple didn't complete — not configured, or the runner backed out. With no
    // email path there is nothing to fall back TO, so the step re-renders with a
    // reassuring notice and a retry rather than a silent no-op.
    state.authError=true;save();
    return 'retry';
  }
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
        signed:!!state.signature
      }),
      signal:controller.signal
    }).then(r=>r.ok?r.json():null).then(d=>(d&&d.id)||null).catch(()=>null).finally(()=>clearTimeout(timer));
  }
  function checkout(){
    const btn=document.getElementById('appleBtn')||document.getElementById('promoNext');
    if(btn){btn.disabled=true;btn.textContent='Saving your plan…';}
    const skip=document.getElementById('promoSkip');if(skip)skip.remove();
    stash().then(id=>{
      // A valid code sends them to that discount's own checkout, not the
      // standard one. An unrecognised code falls through to full price rather
      // than blocking the sale.
      const base=promoLink(state.answers.promo)||CHECKOUT;
      const url=new URL(base),incoming=new URLSearchParams(location.search);
      incoming.forEach((v,k)=>url.searchParams.set(k,v));
      // Top up from the remembered campaign. A runner who lands on a tracked
      // link, closes the tab, and returns by typing the domain arrives with an
      // empty query string — without this, Superwall would record their sale as
      // organic even though a campaign paid for it. Incoming params still win:
      // the link they actually clicked today is the better answer.
      const remembered=window.cadenceAttribution?window.cadenceAttribution().last:{};
      Object.keys(remembered||{}).forEach(k=>{if(!url.searchParams.get(k))url.searchParams.set(k,remembered[k]);});
      url.searchParams.set('name',state.answers.name||'');
      url.searchParams.set('email',state.answers.email||'');
      url.searchParams.set('onboarding','complete');
      if(state.answers.promo)url.searchParams.set('promo',state.answers.promo);
      // Fast path for the app: if Superwall preserves this through redemption,
      // the claim skips the email lookup entirely.
      if(id)url.searchParams.set('onb',id);
      // Only forget the answers once they are safely stored somewhere else.
      // Clearing unconditionally is what used to make the loss permanent.
      if(id)localStorage.removeItem(KEY);
      // The last event of the web funnel, and the one every campaign is
      // ultimately judged on. Identify first so this step and every one before
      // it belong to one person in PostHog before the visitor leaves the site.
      if(window.cadenceIdentify)window.cadenceIdentify();
      // Hand PostHog's visitor id to Superwall. Superwall copies `app_user_id`
      // into Stripe's `client_reference_id` and into subscription metadata as
      // `_sw_app_user_id`, so the trial and the charge come back to the Worker
      // carrying this exact id — which is how a link is followed all the way to
      // a payment without collecting an email or matching a name.
      const visitor=window.cadenceVisitorId?window.cadenceVisitorId():'';
      if(visitor)url.searchParams.set('app_user_id',visitor);
      if(window.cadenceTrack)window.cadenceTrack('web_checkout_started',{stashed:!!id,promo:state.answers.promo||''});
      location.assign(url.toString());
    });
  }
  function wire(){
    screen.querySelectorAll('.option').forEach(el=>el.addEventListener('click',()=>choose(el.dataset.key,el.dataset.value)));
    const n=document.getElementById('next');if(n)n.onclick=next;
    const ni=document.getElementById('nameInput'),nn=document.getElementById('nameNext');if(ni){ni.focus();ni.oninput=()=>{state.answers.name=ni.value;save();nn.disabled=!ni.value.trim();};nn.onclick=()=>{if(ni.value.trim()){state.answers.name=ni.value.trim();next();}};ni.onkeydown=e=>{if(e.key==='Enter'&&ni.value.trim())nn.click();};}
    // Welcome hero. One cycle: shielded while the run bar fills, then the tiles
    // flip open and it starts over. Reduce Motion holds the unlocked state.
    const mock=document.getElementById('mock');
    if(mock){
      const bar=mock.querySelector('.mockbar span'),chip=document.getElementById('mockChip'),label=document.getElementById('mockLabel');
      if(reduceMotion){mock.classList.add('unlocked');chip.textContent='Unlocked';label.textContent='Your day, handed back';bar.style.width='100%';}
      else{
        const cycle=()=>{
          mock.classList.remove('unlocked');chip.textContent='Run to unlock';label.textContent='10 minutes to unlock';
          bar.style.transition='none';bar.style.width='0%';
          requestAnimationFrame(()=>{bar.style.transition='width 2.8s linear';bar.style.width='100%';});
          mockTimer=setTimeout(()=>{
            mock.classList.add('unlocked');chip.textContent='Unlocked';label.textContent='Your day, handed back';
            mockTimer=setTimeout(cycle,1600);
          },2800);
        };
        cycle();
      }
    }
    // The web equivalent of the app's "Already have a membership?" escape hatch:
    // someone who already paid must not have to walk thirty steps to say so.
    const have=document.getElementById('haveMembership');if(have)have.onclick=()=>location.assign('manage-subscription.html');
    const apple=document.getElementById('appleBtn');if(apple)apple.onclick=appleSignIn;
    // Promo entry. Applying an unknown code is a correctable mistake, not a
    // dead end — it re-renders with a notice and the runner can skip past it.
    const pi=document.getElementById('promoInput'),pn=document.getElementById('promoNext'),ps=document.getElementById('promoSkip');
    if(pi){
      pi.focus();
      pi.oninput=()=>{state.answers.promo=pi.value.trim();state.promoError=false;save();};
      const apply=()=>{
        const code=(pi.value||'').trim();
        if(!code){state.answers.promo='';save();return checkout();}
        if(!promoLink(code)){state.promoError=true;state.answers.promo=code;save();render();return;}
        state.answers.promo=code;state.promoError=false;save();checkout();
      };
      pn.onclick=apply;
      pi.onkeydown=e=>{if(e.key==='Enter')apply();};
      if(ps)ps.onclick=()=>{state.answers.promo='';state.promoError=false;save();checkout();};
    }
    // The payoff beat: the grid opens a moment after the screen lands, so the
    // runner watches the shield lift rather than arriving after it already has.
    const unlockMock=document.getElementById('unlockMock');
    if(unlockMock){
      if(reduceMotion)unlockMock.classList.add('unlocked');
      else mockTimer=setTimeout(()=>unlockMock.classList.add('unlocked'),450);
    }
    const slide=document.getElementById('slide');if(slide){let start=0;slide.onpointerdown=e=>{start=e.clientX;slide.setPointerCapture(e.pointerId)};slide.onpointerup=e=>{if(e.clientX-start>80)next();};slide.onclick=()=>next();}
    const ring=document.getElementById('runRing');if(ring){let p=0;const timer=setInterval(()=>{if(state.step!==steps.findIndex(s=>s.id==='run'))return clearInterval(timer);p+=2;ring.style.setProperty('--run',p+'%');document.getElementById('runText').textContent=Math.min(10,Math.floor(p/10))+':00';if(p>=100){clearInterval(timer);const b=document.getElementById('runNext');b.disabled=false;b.textContent='See what happens';b.onclick=next;}},100);}
    const canvas=document.getElementById('signature');if(canvas){const ctx=canvas.getContext('2d');ctx.strokeStyle='#17301b';ctx.lineWidth=5;ctx.lineCap='round';let drawing=false;const pt=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};canvas.onpointerdown=e=>{drawing=true;const p=pt(e);ctx.beginPath();ctx.moveTo(p.x,p.y);canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drawing)return;const p=pt(e);ctx.lineTo(p.x,p.y);ctx.stroke();state.signature=true;document.getElementById('commitNext').disabled=false;save();};canvas.onpointerup=()=>drawing=false;document.getElementById('clearSig').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);state.signature=false;save();document.getElementById('commitNext').disabled=true;};document.getElementById('commitNext').onclick=next;}
  }
  let autoTimer,mockTimer,lastChapter=null;
  /// Drives the per-chapter bar. Within a chapter it animates up to the new
  /// fill; crossing a boundary it snaps empty first, then fills, so each chapter
  /// gets a visibly fresh bar. Reduce Motion skips straight to the target.
  function syncChapterBar(){
    const here=chapterOf(steps[state.step].id);
    const target=Math.round(chapterProgress()*100)+'%';
    const crossed=lastChapter!==null&&lastChapter!==here;
    lastChapter=here;
    if(crossed&&!reduceMotion){
      fill.style.transition='none';
      fill.style.width='0%';
      // Two frames: one to commit the reset, one to animate away from it.
      requestAnimationFrame(()=>requestAnimationFrame(()=>{fill.style.transition='';fill.style.width=target;}));
    }else{
      fill.style.transition=reduceMotion?'none':'';
      fill.style.width=target;
    }
  }
  // One event per step reached, at most once per page load. The funnel in
  // PostHog is these events in order, broken down by `utm_source` — which
  // attribution.js has already registered as a super property on every capture,
  // so a step event carries the campaign that produced it without being told.
  // Re-renders (the Apple return leg, a rejected promo code) must not inflate a
  // step's count, hence the seen set.
  const seenSteps={};
  function trackStep(id){
    if(seenSteps[id]||!window.cadenceTrack)return;
    seenSteps[id]=true;
    window.cadenceTrack('web_onboarding_step',{step:id,index:state.step,chapter:chapterOf(id)});
  }
  function render(){clearTimeout(autoTimer);clearTimeout(mockTimer);state.step=Math.max(0,Math.min(state.step,steps.length-1));const step=steps[state.step];syncChapterBar();back.disabled=state.step===0;screen.innerHTML=step.render();wire();trackStep(step.id);if(step.auto)autoTimer=setTimeout(next,step.auto);window.scrollTo(0,0);}
  back.onclick=()=>{if(state.step>0){state.step--;save();render();}};
  restart.onclick=()=>{if(confirm('Restart Cadence onboarding?')){localStorage.removeItem(KEY);state.step=0;state.answers={};state.signature=false;state.authError=false;state.appleSignedIn=false;state.promoError=false;lastChapter=null;render();}};
  assertChapters();
  // Returning from Apple lands mid-flow, so place the runner back on the step
  // they left before the first paint.
  const auth=consumeAuthRedirect();
  if(auth)state.step=steps.findIndex(s=>s.id===(auth==='ok'?'promo':'signIn'));
  // A paywall "Redeem code" tap arrives as ?promo=1 and jumps straight here.
  // Deliberately not gated on having a saved session: `checkout` clears
  // localStorage once the answers are safely stashed, so by the time anyone is
  // on the paywall to tap Redeem, their session is already gone. Gating on it
  // would drop them back at question one.
  if(!auth&&new URLSearchParams(location.search).get('promo')){
    state.step=steps.findIndex(s=>s.id==='promo');
  }
  render();
})();
