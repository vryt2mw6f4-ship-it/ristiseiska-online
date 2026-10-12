const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const app = express(), server = http.createServer(app), io = new Server(server);
app.use(express.static("public"));
app.get("/health", (_req,res)=>res.json({ok:true}));
const rooms = new Map(), SUITS = ["♠","♥","♦","♣"];
const names = {1:"A",11:"J",12:"Q",13:"K"};
const label = c => `${names[c.rank]||c.rank}${c.suit}`;
const clean = n => String(n||"Pelaaja").trim().slice(0,18)||"Pelaaja";
const shuffle = a => { a=[...a]; for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const deck = () => SUITS.flatMap(s=>Array.from({length:13},(_,i)=>({suit:s,rank:i+1,id:`${s}-${i+1}`})));
const newCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();
function canPlay(c,r){const a=r.board[c.suit];if(!a.length)return c.rank===7;return c.rank===Math.min(...a)-1||c.rank===Math.max(...a)+1;}
function legal(p,r){return p.hand.filter(c=>canPlay(c,r));}
function next(r,from){for(let k=1;k<=r.players.length;k++){let i=(from+k)%r.players.length;if(!r.players[i].finished)return i;}return -1;}
function pub(r,sid){let me=r.players.find(p=>p.socketId===sid);return {code:r.code,started:r.started,turnIndex:r.turnIndex,turnPlayerId:r.players[r.turnIndex]?.id||null,players:r.players.map(p=>({id:p.id,name:p.name,isBot:p.isBot,finished:p.finished,place:p.place,cardCount:p.hand.length,isMe:p.id===me?.id})),board:r.board,myHand:me?me.hand:[],myPlayerId:me?.id||null,lastAction:r.lastAction,status:r.status,results:r.results,round:r.round};}
function emit(r){r.players.forEach(p=>{if(p.socketId)io.to(p.socketId).emit("state",pub(r,p.socketId));});}
function create(socket,name){let code=newCode();while(rooms.has(code))code=newCode();let r={code,started:false,turnIndex:0,players:[{id:crypto.randomUUID(),socketId:socket.id,name:clean(name),isBot:false,hand:[],finished:false,place:null}],board:Object.fromEntries(SUITS.map(s=>[s,[]])),lastAction:"Huone luotu. Jaa koodi kaverille.",status:"Odotetaan pelaajia",results:[],round:0,timer:null};rooms.set(code,r);socket.join(code);socket.data.code=code;return r;}
function addBot(r){r.players.push({id:`bot-${crypto.randomUUID()}`,socketId:null,name:["Pata-Pete","Ruutu-Riikka","Hertta-Hessu"][r.players.length%3],isBot:true,hand:[],finished:false,place:null});}
function start(r){if(r.started||r.players.length!==3)return;r.started=true;r.round++;r.board=Object.fromEntries(SUITS.map(s=>[s,[]]));r.results=[];r.players.forEach(p=>{p.hand=[];p.finished=false;p.place=null;});shuffle(deck()).forEach((c,i)=>r.players[i%3].hand.push(c));r.players.forEach(p=>p.hand.sort((a,b)=>SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit)||a.rank-b.rank));r.turnIndex=r.players.findIndex(p=>p.hand.some(c=>c.suit==="♦"&&c.rank===7));r.status="Peli käynnissä";r.lastAction=`${r.players[r.turnIndex].name} aloittaa ruutuseiskalla.`;emit(r);botTurn(r);}
function finish(r,p){if(!p.finished&&p.hand.length===0){p.finished=true;p.place=r.results.length+1;r.results.push({playerId:p.id,name:p.name,place:p.place,points:p.place});r.lastAction=`${p.name} sai sijan ${p.place} ja ${p.place} pistettä.`;}}
function after(r,from){if(r.players.every(p=>p.finished)){r.status="Peli päättynyt";r.started=false;}else r.turnIndex=next(r,from);emit(r);botTurn(r);}
function takeFromPrevious(r,p){let idx=r.players.indexOf(p),prev=null;for(let k=1;k<r.players.length;k++){let candidate=r.players[(idx-k+r.players.length)%r.players.length];if(candidate.hand.length){prev=candidate;break;}}if(!prev){r.lastAction=`${p.name} ei voinut pelata eikä nostettavia kortteja ole.`;after(r,idx);return;}let [c]=prev.hand.splice(Math.floor(Math.random()*prev.hand.length),1);p.hand.push(c);p.hand.sort((a,b)=>SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit)||a.rank-b.rank);r.lastAction=`${p.name} nosti satunnaisen kortin pelaajalta ${prev.name}.`;finish(r,prev);after(r,idx);}
function play(r,p,id){let i=p.hand.findIndex(c=>c.id===id);if(i<0)return {ok:false,error:"Korttia ei löydy."};let c=p.hand[i];if(!canPlay(c,r))return {ok:false,error:"Tätä korttia ei voi pelata nyt."};p.hand.splice(i,1);r.board[c.suit].push(c.rank);r.board[c.suit].sort((a,b)=>a-b);r.lastAction=`${p.name} pelasi ${label(c)}.`;finish(r,p);after(r,r.turnIndex);return {ok:true};}
function turn(r,p,id){if(!r.started)return {ok:false,error:"Peli ei ole käynnissä."};if(r.players[r.turnIndex]?.id!==p.id)return {ok:false,error:"Ei ole sinun vuorosi."};let moves=legal(p,r);if(moves.length){if(!id)return {ok:false,error:"Sinulla on pelattava kortti — pakko pelata."};return play(r,p,id);}if(id)return {ok:false,error:"Ei laillista siirtoa. Nosta kortti edelliseltä pelaajalta."};takeFromPrevious(r,p);return {ok:true};}
function botTurn(r){if(r.timer)clearTimeout(r.timer);if(!r.started)return;let p=r.players[r.turnIndex];if(!p?.isBot)return;r.timer=setTimeout(()=>{if(!r.started||r.players[r.turnIndex]?.id!==p.id)return;let moves=legal(p,r);if(!moves.length)return takeFromPrevious(r,p);let c=moves.sort((a,b)=>Number(r.board[a.suit].length===0)-Number(r.board[b.suit].length===0)||Math.random()-.5)[0];play(r,p,c.id);},850);}
function fill(r){while(r.players.length<3)addBot(r);}
io.on("connection",s=>{
 s.on("create-room",({name}={},cb=()=>{})=>{let r=create(s,name);cb({ok:true,code:r.code});emit(r);});
 s.on("join-room",({code,name}={},cb=()=>{})=>{let r=rooms.get(String(code||"").toUpperCase());if(!r)return cb({ok:false,error:"Huonetta ei löydy."});if(r.started)return cb({ok:false,error:"Peli on jo käynnissä."});if(r.players.some(p=>p.socketId===s.id))return cb({ok:true,code:r.code});let bot=r.players.findIndex(p=>p.isBot);if(bot>=0)r.players.splice(bot,1);if(r.players.length>=3)return cb({ok:false,error:"Huone on täynnä."});r.players.push({id:crypto.randomUUID(),socketId:s.id,name:clean(name),isBot:false,hand:[],finished:false,place:null});s.join(r.code);s.data.code=r.code;cb({ok:true,code:r.code});if(r.players.filter(p=>!p.isBot&&p.socketId).length>=2){fill(r);start(r);}else emit(r);});
 s.on("start-with-bots",(_,cb=()=>{})=>{let r=rooms.get(s.data.code);if(!r)return cb({ok:false,error:"Luo huone ensin."});fill(r);start(r);cb({ok:true});});
 s.on("play-card",({cardId}={},cb=()=>{})=>{let r=rooms.get(s.data.code),p=r?.players.find(p=>p.socketId===s.id);if(!p)return cb({ok:false,error:"Huonetta tai pelaajaa ei löydy."});cb(turn(r,p,cardId));});
 s.on("draw-card",(_,cb=()=>{})=>{let r=rooms.get(s.data.code),p=r?.players.find(p=>p.socketId===s.id);if(!p)return cb({ok:false,error:"Huonetta tai pelaajaa ei löydy."});cb(turn(r,p,null));});
 s.on("disconnect",()=>{let r=rooms.get(s.data.code);if(!r)return;let p=r.players.find(p=>p.socketId===s.id);if(p&&!r.started)p.socketId=null;emit(r);});
});
server.listen(process.env.PORT||3000,()=>console.log("Ristiseiska at port "+(process.env.PORT||3000)));
