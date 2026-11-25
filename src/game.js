(() => {
  "use strict";
  const canvas = document.getElementById("renderCanvas");
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, antialias: true });
  const $ = (id) => document.getElementById(id);
  const input = { x: 0, z: 0, block: false, actions: [], cameraX: 0, cameraY: 0 };
  const keys = new Set();
  let scene, player, enemy, camera, running = false, paused = false, gameOver = false;
  let timeLeft = 99, lastSecond = 0, toastTimer = 0, aiTimer = 0, roundStarted = false;
  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
  const vec = (x=0,y=0,z=0) => new BABYLON.Vector3(x,y,z);

  function material(name, color, metallic=0, roughness=.65) {
    const m = new BABYLON.PBRMaterial(name, scene);
    m.albedoColor = BABYLON.Color3.FromHexString(color);
    m.metallic = metallic; m.roughness = roughness;
    return m;
  }
  function makeArena() {
    const ground = BABYLON.MeshBuilder.CreateGround("arena-floor", {width:34,height:26,subdivisions:2}, scene);
    const floorMat = material("obsidian-floor", "#242a33", .55, .32); floorMat.albedoTexture = null; ground.material = floorMat;
    // Keep the physical floor material; grid-like inlaid strips add arena scale.
    for (let x=-15;x<=15;x+=5) { const line=BABYLON.MeshBuilder.CreateBox("floor-line",{width:.035,height:.012,depth:24},scene); line.position.set(x,.012,0); line.material=material("line-"+x,"#59616d",.7,.4); }
    for (let z=-10;z<=10;z+=5) { const line=BABYLON.MeshBuilder.CreateBox("floor-line",{width:32,height:.012,depth:.035},scene); line.position.set(0,.013,z); line.material=material("line-z"+z,"#59616d",.7,.4); }
    const wallMat=material("arena-wall","#111720",.65,.38), trimMat=material("red-trim","#7f292b",.65,.3);
    const walls=[
      {w:34,h:7,d:.6,x:0,y:3.5,z:-13},
      {w:34,h:7,d:.6,x:0,y:3.5,z:13},
      {w:.6,h:7,d:26,x:-17,y:3.5,z:0},
      {w:.6,h:7,d:26,x:17,y:3.5,z:0}
    ];
    walls.forEach((p,i)=>{const b=BABYLON.MeshBuilder.CreateBox("arena-wall-"+i,{width:p.w,height:p.h,depth:p.d},scene);b.position.set(p.x,p.y,p.z);b.material=wallMat;});
    for(let i=-1;i<=1;i++){const pillar=BABYLON.MeshBuilder.CreateBox("pillar",{width:1.1,height:7.5,depth:1.1},scene);pillar.position.set(i*11,3.75,-12.5);pillar.material=trimMat;}
    const platform=BABYLON.MeshBuilder.CreateBox("center-platform",{width:9,height:.08,depth:7},scene);platform.position.y=.04;platform.material=material("platform","#303945",.6,.4);
    const ring=BABYLON.MeshBuilder.CreateTorus("arena-ring",{diameter:15,thickness:.06,tessellation:96},scene);ring.rotation.x=Math.PI/2;ring.position.y=.04;ring.material=trimMat;
    const glowMat=new BABYLON.StandardMaterial("glow",scene);glowMat.emissiveColor=new BABYLON.Color3(.55,.08,.07);
    for(let i=0;i<8;i++){const lamp=BABYLON.MeshBuilder.CreateBox("wall-light",{width:2.3,height:.12,depth:.12},scene);lamp.position.set(-12+i*3.4,5.6,-12.55);lamp.material=glowMat;}
  }

  function createFighter(name, position, color, accent, isPlayer) {
    const root=new BABYLON.TransformNode(name+"-root",scene); root.position.copyFrom(position);
    const bodyMat=material(name+"-armor",color,.48,.38), accentMat=material(name+"-accent",accent,.62,.28);
    const skinMat=material(name+"-skin","#a66e55",0,.8), darkMat=material(name+"-dark","#171b22",.2,.65);
    const parts={};
    function capsule(key, diameter, height, mat, pos, parent=root) {
      const mesh=BABYLON.MeshBuilder.CreateCapsule(name+"-"+key,{radius:diameter/2,height,tessellation:12,subdivisions:4},scene);
      mesh.parent=parent;mesh.position.copyFrom(pos);mesh.material=mat;parts[key]=mesh;return mesh;
    }
    function sphere(key, diameter, mat, pos, parent=root) {
      const mesh=BABYLON.MeshBuilder.CreateSphere(name+"-"+key,{diameter,segments:16},scene);
      mesh.parent=parent;mesh.position.copyFrom(pos);mesh.material=mat;parts[key]=mesh;return mesh;
    }
    capsule("torso",.88,1.35,bodyMat,vec(0,1.55,0));
    capsule("waist",.72,.5,darkMat,vec(0,.93,0));
    sphere("head",.58,skinMat,vec(0,2.55,0));
    const hair=BABYLON.MeshBuilder.CreateSphere(name+"-hair",{diameter:.61,segments:12},scene);hair.parent=root;hair.position.set(0,2.77,-.015);hair.scaling.y=.55;hair.material=darkMat;
    const shoulderL=sphere("shoulderL",.43,accentMat,vec(-.57,2.02,0));
    const shoulderR=sphere("shoulderR",.43,accentMat,vec(.57,2.02,0));
    function limb(key, a, b, radius, mat) {
      const mid=a.add(b).scale(.5), length=BABYLON.Vector3.Distance(a,b);
      const mesh=BABYLON.MeshBuilder.CreateCylinder(name+"-"+key,{height:length,diameter:radius,tessellation:12},scene);
      mesh.parent=root;mesh.position.copyFrom(mid);mesh.rotation.z=Math.atan2(b.x-a.x,b.y-a.y);mesh.material=mat;parts[key]=mesh;
      const joint=sphere(key+"-joint",radius*1.12,mat,a); return {mesh,joint,a,b};
    }
    const arms=[
      limb("upperArmL",vec(-.62,1.98,0),vec(-.78,1.43,0),.27,bodyMat),
      limb("forearmL",vec(-.78,1.43,0),vec(-.7,1.05,.08),.23,accentMat),
      limb("upperArmR",vec(.62,1.98,0),vec(.78,1.43,0),.27,bodyMat),
      limb("forearmR",vec(.78,1.43,0),vec(.7,1.05,.08),.23,accentMat),
      limb("thighL",vec(-.27,.86,0),vec(-.32,.36,0),.34,darkMat),
      limb("shinL",vec(-.32,.36,0),vec(-.34,.12,.06),.25,bodyMat),
      limb("thighR",vec(.27,.86,0),vec(.32,.36,0),.34,darkMat),
      limb("shinR",vec(.32,.36,0),vec(.34,.12,.06),.25,bodyMat)
    ];
    const gloveL=sphere("gloveL",.31,accentMat,vec(-.7,1.02,.08)), gloveR=sphere("gloveR",.31,accentMat,vec(.7,1.02,.08));
    const shadow=BABYLON.MeshBuilder.CreateDisc(name+"-shadow",{radius:1.05,tessellation:32},scene);shadow.parent=root;shadow.rotation.x=Math.PI/2;shadow.position.y=.035;shadow.scaling.x=.72;shadow.material=new BABYLON.StandardMaterial(name+"-shadow-mat",scene);shadow.material.diffuseColor=new BABYLON.Color3(0,0,0);shadow.material.alpha=.24;
    return {name,root,parts,bodyMat,accentMat,arms,gloveL,gloveR,health:100,meter:0,isPlayer,blocking:false,attack:0,attackType:"",cooldown:0,hitThisAttack:false,stun:0,dodge:0,jump:0,walk:0,baseY:0,damageFlash:0};
  }

  function createScene() {
    scene=new BABYLON.Scene(engine);scene.clearColor=new BABYLON.Color4(.035,.045,.065,1);scene.collisionsEnabled=true;
    const hemi=new BABYLON.HemisphericLight("ambient",vec(0,1,0),scene);hemi.intensity=.68;hemi.groundColor=new BABYLON.Color3(.12,.14,.18);
    const key=new BABYLON.DirectionalLight("key",vec(-.5,-1,.6),scene);key.position=vec(8,14,-8);key.intensity=2.2;
    const rim=new BABYLON.PointLight("rim",vec(-10,6,7),scene);rim.diffuse=new BABYLON.Color3(.25,.42,.8);rim.intensity=85;rim.range=35;
    const red=new BABYLON.PointLight("red",vec(10,5,-6),scene);red.diffuse=new BABYLON.Color3(1,.13,.08);red.intensity=65;red.range=28;
    makeArena();
    camera=new BABYLON.ArcRotateCamera("combat-camera",-Math.PI/2,1.08,13,vec(0,1.2,0),scene);
    camera.lowerRadiusLimit=8;camera.upperRadiusLimit=17;camera.lowerBetaLimit=.65;camera.upperBetaLimit=1.35;camera.panningSensibility=0;camera.wheelPrecision=80;camera.attachControl(canvas,true);camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
    player=createFighter("VEX",vec(-3,0,0),"#303b4b","#a63c3b",true);
    enemy=createFighter("KAEL",vec(3,0,0),"#45413a","#d18b35",false);
    player.root.rotation.y=Math.PI/2;enemy.root.rotation.y=-Math.PI/2;
    scene.onBeforeRenderObservable.add(update);
    return scene;
  }

  function showToast(message) { const el=$("toast");el.textContent=message;el.classList.add("show");toastTimer=1.15; }
  function message(title,sub="") { const el=$("centerMessage");el.innerHTML=`<strong>${title}</strong><span>${sub}</span>`;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1100); }
  function faceTarget(f) { const target=f===player?enemy:player; const dx=target.root.position.x-f.root.position.x,dz=target.root.position.z-f.root.position.z;f.root.rotation.y=Math.atan2(dx,dz); }
  function startAttack(f,type) {
    if(!running||paused||gameOver||f.stun>0||f.attack>0||f.cooldown>0||f.dodge>0)return;
    f.attackType=type;f.attack=type==="special"?.78:type==="heavy"?.65:type==="grab"?.55:.42;f.hitThisAttack=false;f.cooldown=type==="light"?.32:type==="heavy"?.65:type==="special"?1.1:.8;
    faceTarget(f); if(type==="special") f.meter=Math.max(0,f.meter-35);
  }
  function damage(attacker, defender, amount, type) {
    const dist=BABYLON.Vector3.Distance(attacker.root.position,defender.root.position);
    if(dist>(type==="grab"?2.05:type==="special"?3.15:2.25))return;
    const forward=vec(Math.sin(attacker.root.rotation.y),0,Math.cos(attacker.root.rotation.y));
    const toward=defender.root.position.subtract(attacker.root.position).normalize();
    if(BABYLON.Vector3.Dot(forward,toward)<.2)return;
    if(defender.blocking && type!=="grab") {amount*=.18;showToast("BLOCKED");}
    else {defender.stun=type==="heavy"?.42:.24;defender.root.position.addInPlace(toward.scale(type==="heavy"?.55:.25));}
    defender.health=clamp(defender.health-amount,0,100);attacker.meter=clamp(attacker.meter+amount*.7,0,100);
    defender.damageFlash=.16;
    if(type==="special")screenShake(.22);
    updateHUD();
    if(defender.health<=0)finish(attacker===player);
  }
  let shake=0;
  function screenShake(amount){shake=Math.max(shake,amount);}
  function finish(playerWon) {
    if(gameOver)return;gameOver=true;running=false;
    $("endTitle").textContent=playerWon?"VICTORY":"DEFEAT";
    $("endCopy").textContent=playerWon?"The arena belongs to you.":"The opponent takes the round. Return stronger.";
    $("endScreen").classList.remove("hidden");
  }
  function updateHUD() {
    $("playerHealth").style.width=player.health+"%";$("enemyHealth").style.width=enemy.health+"%";
    $("playerMeter").style.width=player.meter+"%";$("enemyMeter").style.width=enemy.meter+"%";
  }
  function moveFighter(f,dx,dz,dt) {
    const speed=f.dodge>0?9.2:(keys.has("Shift")&&f.isPlayer?6.4:4.2);
    const forward=vec(Math.sin(f.root.rotation.y),0,Math.cos(f.root.rotation.y));
    const right=vec(forward.z,0,-forward.x);
    const desired=right.scale(dx).add(forward.scale(dz));
    if(desired.lengthSquared()>1)desired.normalize();
    if(f.stun<=0&&!f.blocking&&f.attack<.2)f.root.position.addInPlace(desired.scale(speed*dt));
    f.walk=desired.length();
    f.root.position.x=clamp(f.root.position.x,-15.2,15.2);f.root.position.z=clamp(f.root.position.z,-11.2,11.2);
    if(desired.lengthSquared()>.01 && f.attack<=0 && f.dodge<=0) {
      // Turn toward movement direction, with player camera-relative movement.
      if(!f.isPlayer) f.root.rotation.y=Math.atan2(desired.x,desired.z);
    }
  }
  function animateFighter(f,dt) {
    f.cooldown=Math.max(0,f.cooldown-dt);f.stun=Math.max(0,f.stun-dt);f.dodge=Math.max(0,f.dodge-dt);f.attack=Math.max(0,f.attack-dt);
    f.jump=Math.max(0,f.jump-dt);
    const t=performance.now()*.001;
    const bob=Math.sin(t*9)*.035*f.walk;
    f.parts.torso.position.y=1.55+bob;
    f.parts.head.position.y=2.55+bob;
    f.parts.upperArmL.rotation.z=f.blocking?-.8:Math.sin(t*9)*.08*f.walk;
    f.parts.upperArmR.rotation.z=f.blocking?.8:-Math.sin(t*9)*.08*f.walk;
    if(f.attack>0) {
      const total=f.attackType==="special"?.78:f.attackType==="heavy"?.65:f.attackType==="grab"?.55:.42;
      const progress=1-f.attack/total;
      const active=progress>.28&&progress<.68;
      if(active&&!f.hitThisAttack){damage(f,f===player?enemy:player,f.attackType==="special"?19:f.attackType==="heavy"?14:f.attackType==="grab"?12:7,f.attackType);f.hitThisAttack=true;}
      const arm=f.attackType==="heavy"||f.attackType==="special"?"forearmR":"forearmL";
      f.parts[arm].rotation.x=active?-1.0:0;
      f.parts.torso.rotation.y=active?.18:0;
      if(f.attackType==="special"&&active)spawnImpact(f.root.position.add(vec(0,1.4,0)),f.accentMat.albedoColor);
    } else {f.parts.forearmL.rotation.x=0;f.parts.forearmR.rotation.x=0;f.parts.torso.rotation.y=0;}
    f.root.position.y=f.jump>0?Math.sin((f.jump/.55)*Math.PI)*1.2:0;
    f.parts.torso.position.y=1.55+bob;
    f.blocking=input.block&&f.isPlayer;
    if(f.damageFlash>0){f.damageFlash-=dt;f.bodyMat.emissiveColor=new BABYLON.Color3(.35,.04,.03);}else f.bodyMat.emissiveColor=BABYLON.Color3.Black();
  }
  let impactCooldown=0;
  function spawnImpact(pos,color) {
    if(impactCooldown>0)return;impactCooldown=.18;
    const p=BABYLON.MeshBuilder.CreateSphere("impact",{diameter:.22,segments:8},scene);p.position.copyFrom(pos);const m=new BABYLON.StandardMaterial("impact-mat",scene);m.emissiveColor=color;p.material=m;
    const scale=new BABYLON.Animation("impact-scale","scaling",30,BABYLON.Animation.ANIMATIONTYPE_VECTOR3,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    scale.setKeys([{frame:0,value:vec(.4,.4,.4)},{frame:8,value:vec(3,3,3)}]);p.animations=[scale];scene.beginAnimation(p,0,8,false,1,()=>p.dispose());
  }
  function aiThink(dt) {
    aiTimer-=dt;if(aiTimer>0)return;aiTimer=.24+Math.random()*.2;
    const d=BABYLON.Vector3.Distance(enemy.root.position,player.root.position);
    enemy.blocking=false;
    if(player.attack>0&&d<2.8&&Math.random()<.34){enemy.blocking=true;return;}
    if(d>2.1){const dir=player.root.position.subtract(enemy.root.position).normalize();moveFighter(enemy,dir.x,dir.z,Math.min(dt,.18));}
    else {
      faceTarget(enemy);
      const roll=Math.random();
      if(roll<.28)startAttack(enemy,"light");else if(roll<.49)startAttack(enemy,"heavy");else if(roll<.59)startAttack(enemy,"grab");else if(roll<.73){enemy.dodge=.28;const away=enemy.root.position.subtract(player.root.position).normalize();enemy.root.position.addInPlace(away.scale(1.2));}
    }
  }
  function update() {
    if(!scene)return;const dt=Math.min(engine.getDeltaTime()/1000,.04);impactCooldown=Math.max(0,impactCooldown-dt);
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$("toast").classList.remove("show");}
    if(!running||paused)return;
    animateFighter(player,dt);animateFighter(enemy,dt);
    let dx=input.x+(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0);
    let dz=input.z+(keys.has("KeyW")?1:0)-(keys.has("KeyS")?1:0);
    // Camera-relative movement.
    const forward=vec(Math.sin(camera.alpha),0,Math.cos(camera.alpha));
    const right=vec(forward.z,0,-forward.x);
    const move=right.scale(dx).add(forward.scale(dz));
    if(move.lengthSquared()>1) move.normalize();
    player.walk=move.length();
    if(player.stun<=0&&!player.blocking&&player.attack<.2&&player.dodge<=0) {
      const speed=keys.has("Shift")?6.4:4.2;
      player.root.position.addInPlace(move.scale(speed*dt));
    }
    player.root.position.x=clamp(player.root.position.x,-15.2,15.2);
    player.root.position.z=clamp(player.root.position.z,-11.2,11.2);
    if(player.walk>.05&&player.attack<=0)player.root.rotation.y=Math.atan2(move.x,move.z);
    if(input.block||keys.has("KeyL"))player.blocking=true;
    aiThink(dt);
    const mid=player.root.position.add(enemy.root.position).scale(.5);mid.y=1.25;
    camera.setTarget(BABYLON.Vector3.Lerp(camera.target,mid,.055));
    const separation=BABYLON.Vector3.Distance(player.root.position,enemy.root.position);
    camera.radius=clamp(10.5+separation*.55,11,16);
    if(shake>0){camera.target.x+=(Math.random()-.5)*shake;camera.target.y+=(Math.random()-.5)*shake;shake=Math.max(0,shake-dt);}
    if(performance.now()-lastSecond>1000){timeLeft=Math.max(0,timeLeft-1);$("timer").textContent=String(timeLeft).padStart(2,"0");lastSecond=performance.now();if(timeLeft===0)finish(player.health>=enemy.health);}
  }

  function action(name,down=true) {
    if(!down)return;
    if(name==="block"){input.block=true;return;}
    if(name==="light"||name==="heavy"||name==="special"||name==="grab")startAttack(player,name);
    if(name==="dodge"){if(player.dodge<=0){player.dodge=.28;const away=player.root.position.subtract(enemy.root.position).normalize();player.root.position.addInPlace(away.scale(1.25));}}
    if(name==="jump"&&player.jump<=0)player.jump=.55;
    if(name==="lock"){faceTarget(player);showToast("TARGET LOCKED");}
  }
  function bindControls() {
    document.querySelectorAll("[data-action]").forEach(btn=>{
      const a=btn.dataset.action;
      const down=e=>{e.preventDefault();btn.classList.add("pressed");action(a,true);};
      const up=e=>{e.preventDefault();btn.classList.remove("pressed");if(a==="block")input.block=false;};
      btn.addEventListener("pointerdown",down);btn.addEventListener("pointerup",up);btn.addEventListener("pointercancel",up);btn.addEventListener("pointerleave",up);
    });
    const base=$("stickBase"),knob=$("stickKnob");let pointer=null,origin=null;
    base.addEventListener("pointerdown",e=>{e.preventDefault();pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};base.setPointerCapture(pointer);});
    base.addEventListener("pointermove",e=>{if(pointer!==e.pointerId||!origin)return;const dx=e.clientX-origin.x,dy=e.clientY-origin.y,len=Math.hypot(dx,dy),max=35,k=Math.min(1,max/(len||1));const x=dx*k,y=dy*k;knob.style.transform=`translate(${x}px,${y}px)`;input.x=x/max;input.z=-y/max;});
    const reset=()=>{pointer=null;origin=null;input.x=0;input.z=0;knob.style.transform="translate(0,0)";};
    base.addEventListener("pointerup",reset);base.addEventListener("pointercancel",reset);
    window.addEventListener("keydown",e=>{keys.add(e.code);if(e.repeat)return;const map={KeyJ:"light",KeyK:"heavy",KeyU:"special",KeyI:"grab",KeyO:"dodge",Space:"jump",KeyL:"block"};if(map[e.code])action(map[e.code],true);});
    window.addEventListener("keyup",e=>{keys.delete(e.code);if(e.code==="KeyL")input.block=false;});
    // Gamepad API: left stick + PlayStation-equivalent face/shoulder buttons.
    window.addEventListener("gamepadconnected",()=>showToast("GAMEPAD CONNECTED"));
    window.addEventListener("gamepaddisconnected",()=>showToast("GAMEPAD DISCONNECTED"));
  }
  const gamepadWasPressed = {};
  function pollGamepad() {
    const pads=navigator.getGamepads?.()||[];const pad=Array.from(pads).find(Boolean);if(!pad)return;
    if(Math.abs(pad.axes[0]||0)>.15) input.x=pad.axes[0];
    if(Math.abs(pad.axes[1]||0)>.15) input.z=-(pad.axes[1]);
    else if(!document.querySelector("#stickBase:active")) { /* touch stick owns its own release */ }
    const mapping=[["light",2],["heavy",3],["jump",0],["special",1],["block",4],["grab",5],["dodge",7]];
    mapping.forEach(([name,index])=>{const pressed=!!pad.buttons[index]?.pressed;if(pressed&&!gamepadWasPressed[name])action(name,true);gamepadWasPressed[name]=pressed;});
    input.block=!!pad.buttons[4]?.pressed;
  }

  function resetGame() {
    player.health=100;enemy.health=100;player.meter=0;enemy.meter=0;player.root.position.copyFrom(vec(-3,0,0));enemy.root.position.copyFrom(vec(3,0,0));
    player.root.rotation.y=Math.PI/2;enemy.root.rotation.y=-Math.PI/2;player.attack=enemy.attack=0;player.stun=enemy.stun=0;timeLeft=99;lastSecond=performance.now();gameOver=false;paused=false;running=true;updateHUD();$("timer").textContent="99";$("endScreen").classList.add("hidden");$("pauseScreen").classList.add("hidden");message("FIGHT!","ROUND 01");
  }
  function setupUI() {
    $("startBtn").onclick=()=>{$("startScreen").classList.add("hidden");resetGame();};
    $("rematchBtn").onclick=resetGame;
    $("pauseBtn").onclick=()=>{if(!running||gameOver)return;paused=true;$("pauseScreen").classList.remove("hidden");};
    $("resumeBtn").onclick=()=>{paused=false;$("pauseScreen").classList.add("hidden");};
    $("quitBtn").onclick=()=>{paused=false;running=false;$("pauseScreen").classList.add("hidden");$("startScreen").classList.remove("hidden");};
    canvas.addEventListener("pointerdown",()=>{if(document.pointerLockElement!==canvas&&matchMedia("(hover:hover)").matches){}});
  }

  createScene();bindControls();setupUI();updateHUD();
  engine.runRenderLoop(()=>{pollGamepad();if(scene)scene.render();});
  window.addEventListener("resize",()=>engine.resize());
  $("loading").style.display="none";
})();