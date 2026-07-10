import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const COLORS = {
  bg: '#08080B',
  card: '#11121A',
  card2: '#171827',
  border: '#30264D',
  violet: '#8A2BE2',
  violet2: '#A855F7',
  blue: '#3B82F6',
  text: '#FFFFFF',
  muted: '#A1A1AA',
  green: '#22C55E',
  red: '#EF4444',
  amber: '#F59E0B',
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const n = (v, fallback = 0) => {
  const x = Number(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : fallback;
};
const mmss = (s) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

const EXERCISES = [
  // Polyarticulaires
  ['poly','Arraché / Snatch'], ['poly','Clean'], ['poly','Clean & Jerk'], ['poly','Épaulé-jeté'], ['poly','Thruster'],
  ['poly','Squat arrière'], ['poly','Squat avant'], ['poly','Overhead squat'], ['poly','Soulevé de terre'], ['poly','Soulevé de terre sumo'],
  ['poly','Développé couché'], ['poly','Développé militaire'], ['poly','Push press'], ['poly','Tractions'], ['poly','Dips'], ['poly','Rowing barre'],
  ['poly','Fentes marchées'], ['poly','Hip thrust'], ['poly','Kettlebell swing'], ['poly','Burpees'], ['poly','Pompes'], ['poly','Box jump'],
  ['poly','Wall ball'], ['poly','Muscle-up'], ['poly','Toes to bar'], ['poly','Course à pied'], ['poly','Rameur'], ['poly','SkiErg'], ['poly','Assault bike'],
  // Pectoraux
  ['Pectoraux','Développé incliné haltères'], ['Pectoraux','Développé décliné'], ['Pectoraux','Écarté couché'], ['Pectoraux','Pec deck'], ['Pectoraux','Pompes serrées'],
  // Dos
  ['Dos','Tirage vertical'], ['Dos','Tirage horizontal'], ['Dos','Rowing haltère'], ['Dos','Pull-over poulie'], ['Dos','Shrugs'], ['Dos','Extension lombaire'],
  // Épaules
  ['Épaules','Élévations latérales'], ['Épaules','Élévations frontales'], ['Épaules','Oiseau haltères'], ['Épaules','Face pull'], ['Épaules','Développé Arnold'],
  // Bras
  ['Biceps','Curl barre'], ['Biceps','Curl haltères'], ['Biceps','Curl marteau'], ['Biceps','Curl pupitre'],
  ['Triceps','Extension triceps poulie'], ['Triceps','Barre au front'], ['Triceps','Kickback triceps'], ['Triceps','Dips banc'],
  // Jambes
  ['Quadriceps','Leg extension'], ['Quadriceps','Presse à cuisses'], ['Quadriceps','Hack squat'], ['Quadriceps','Split squat bulgare'],
  ['Ischios','Leg curl assis'], ['Ischios','Leg curl couché'], ['Ischios','Soulevé de terre jambes tendues'], ['Ischios','Nordic curl'],
  ['Fessiers','Abduction machine'], ['Fessiers','Kickback poulie'], ['Fessiers','Glute bridge'],
  ['Mollets','Mollets debout'], ['Mollets','Mollets assis'],
  // Core
  ['Abdos','Crunch'], ['Abdos','Gainage'], ['Abdos','Relevés de jambes'], ['Abdos','Russian twist'], ['Abdos','Planche latérale'], ['Abdos','Ab wheel'],
  // Mobilité / Prépa
  ['Mobilité','Étirement hanches'], ['Mobilité','Mobilité chevilles'], ['Mobilité','Mobilité épaules'], ['Mobilité','Activation scapulaire'], ['Mobilité','Monster walk'],
].map(([group, name]) => ({ id: name, group, name }));

const emptyExercise = () => ({
  id: uid(), name: '', group: '', sets: '4', reps: '10', weight: '60', tempo: '3010', restSet: '90', restExercise: '120'
});

function estimateSession(exs) {
  const tonnage = exs.reduce((acc, e) => acc + n(e.sets) * n(e.reps) * n(e.weight), 0);
  const workSec = exs.reduce((acc, e) => acc + n(e.sets) * n(e.reps) * 4 + Math.max(0, n(e.sets)-1)*n(e.restSet) + n(e.restExercise), 0);
  const minutes = Math.max(10, Math.round(workSec / 60));
  const calories = Math.round(minutes * 7 + tonnage * 0.006);
  return { tonnage: Math.round(tonnage), minutes, calories };
}

function Logo({ small=false }) {
  return <View style={[styles.logoWrap, small && { transform: [{ scale: 0.72 }], marginRight: -6 }]}>
    <MaterialCommunityIcons name="dumbbell" size={small ? 26 : 38} color={COLORS.text} />
  </View>;
}

function Header({ title, back, onBack }) {
  return <View style={styles.header}>
    {back ? <Pressable onPress={onBack} style={styles.iconBtn}><Ionicons name="chevron-back" size={24} color={COLORS.text} /></Pressable> : <Logo small />}
    <Text style={styles.headerTitle}>{title}</Text>
    <View style={{ width: 44 }} />
  </View>;
}

function Button({ children, onPress, variant='primary', style }) {
  return <Pressable onPress={onPress} style={({pressed}) => [styles.btn, variant==='ghost' && styles.btnGhost, variant==='danger' && styles.btnDanger, pressed && { opacity: 0.75 }, style]}>
    <Text style={styles.btnText}>{children}</Text>
  </Pressable>;
}

function StatCard({ label, value, icon }) {
  return <View style={styles.statCard}><Text style={styles.statIcon}>{icon}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { (async () => {
    try {
      const raw = await AsyncStorage.getItem('BRAC_V11');
      if (raw) { const data = JSON.parse(raw); setSessions(data.sessions || []); setHistory(data.history || []); }
    } catch(e) {}
    setLoaded(true);
  })(); }, []);
  useEffect(() => { if (loaded) AsyncStorage.setItem('BRAC_V11', JSON.stringify({ sessions, history })).catch(()=>{}); }, [sessions, history, loaded]);

  const nav = { screen, setScreen, sessions, setSessions, history, setHistory, selectedSession, setSelectedSession };
  return <SafeAreaView style={styles.safe}><StatusBar style="light" />
    {screen==='home' && <Home nav={nav} />}
    {screen==='create' && <CreateSession nav={nav} />}
    {screen==='start' && <StartSession nav={nav} />}
    {screen==='workout' && <Workout nav={nav} />}
    {screen==='stats' && <Stats nav={nav} />}
  </SafeAreaView>;
}

function Home({ nav }) {
  const totalTonnage = nav.history.reduce((a,h)=>a+(h.real?.tonnage||0),0);
  const totalCalories = nav.history.reduce((a,h)=>a+(h.real?.calories||0),0);
  return <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 36 }}>
    <View style={styles.hero}>
      <Logo />
      <Text style={styles.brand}>BRAC</Text>
      <Text style={styles.tagline}>TRAIN. FUEL. PERFORM.</Text>
      <Text style={styles.heroText}>Bonjour Adrien. Prêt à construire ta séance et mesurer ta progression ?</Text>
    </View>
    <View style={styles.row}>
      <StatCard icon="🏋️" value={nav.sessions.length + '/10'} label="Séances" />
      <StatCard icon="🔥" value={totalCalories} label="Calories" />
      <StatCard icon="💪" value={totalTonnage + ' kg'} label="Tonnage" />
    </View>
    <View style={styles.menuGrid}>
      <Pressable style={styles.menuCard} onPress={()=>nav.setScreen('create')}><Ionicons name="add-circle" size={34} color={COLORS.violet2}/><Text style={styles.menuTitle}>Créer</Text><Text style={styles.muted}>Construire une séance complète.</Text></Pressable>
      <Pressable style={styles.menuCard} onPress={()=>nav.setScreen('start')}><Ionicons name="play-circle" size={34} color={COLORS.green}/><Text style={styles.menuTitle}>Démarrer</Text><Text style={styles.muted}>Lancer une séance enregistrée.</Text></Pressable>
      <Pressable style={styles.menuCard} onPress={()=>nav.setScreen('stats')}><Ionicons name="stats-chart" size={34} color={COLORS.blue}/><Text style={styles.menuTitle}>Stats</Text><Text style={styles.muted}>Calories, tonnage, progression.</Text></Pressable>
    </View>
    <Text style={styles.sectionTitle}>Séances enregistrées</Text>
    {nav.sessions.length===0 ? <Text style={styles.empty}>Aucune séance. Clique sur Créer pour commencer.</Text> : nav.sessions.map(s => <SessionCard key={s.id} session={s} onStart={()=>{nav.setSelectedSession(s); nav.setScreen('start')}} onDelete={()=>Alert.alert('Supprimer', `Supprimer ${s.name} ?`, [{text:'Annuler'}, {text:'Supprimer', style:'destructive', onPress:()=>nav.setSessions(nav.sessions.filter(x=>x.id!==s.id))}])} />)}
  </ScrollView>;
}

function SessionCard({ session, onStart, onDelete }) {
  const est = estimateSession(session.exercises);
  return <View style={styles.sessionCard}>
    <View style={{ flex: 1 }}><Text style={styles.sessionTitle}>{session.name}</Text><Text style={styles.muted}>{session.exercises.length} exercices • {est.minutes} min • {est.tonnage} kg • {est.calories} kcal</Text></View>
    <Pressable onPress={onStart} style={styles.smallBtn}><Ionicons name="play" size={18} color="white" /></Pressable>
    <Pressable onPress={onDelete} style={[styles.smallBtn, { backgroundColor: COLORS.red }]}><Ionicons name="trash" size={18} color="white" /></Pressable>
  </View>;
}

function CreateSession({ nav }) {
  const [name, setName] = useState(`Séance ${nav.sessions.length + 1}`);
  const [exercises, setExercises] = useState([emptyExercise()]);
  const est = useMemo(()=>estimateSession(exercises), [exercises]);
  const update = (id, patch) => setExercises(exercises.map(e => e.id===id ? { ...e, ...patch } : e));
  const save = () => {
    if (nav.sessions.length >= 10) return Alert.alert('Limite atteinte', 'La V1.1 permet de créer 10 séances différentes. Supprime une séance pour en créer une nouvelle.');
    const clean = exercises.filter(e => e.name);
    if (!name.trim() || clean.length===0) return Alert.alert('Séance incomplète', 'Ajoute un nom et au moins un exercice.');
    nav.setSessions([...nav.sessions, { id: uid(), name: name.trim(), exercises: clean }]);
    nav.setScreen('home');
  };
  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
    <Header title="Créer une séance" back onBack={()=>nav.setScreen('home')} />
    <Text style={styles.label}>Nom de la séance</Text><TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={COLORS.muted}/>
    <View style={styles.estimateBox}><Text style={styles.estimateTitle}>Estimation automatique</Text><Text style={styles.estimateText}>🔥 {est.calories} kcal   🏋️ {est.tonnage} kg   ⏱ {est.minutes} min</Text></View>
    {exercises.map((ex, idx) => <ExerciseEditor key={ex.id} ex={ex} index={idx} update={update} remove={()=>setExercises(exercises.filter(e=>e.id!==ex.id))} />)}
    <Button onPress={()=>setExercises([...exercises, emptyExercise()])} variant="ghost">+ Ajouter un exercice</Button>
    <Button onPress={save}>Enregistrer la séance</Button>
  </ScrollView></KeyboardAvoidingView>;
}

function ExerciseEditor({ ex, index, update, remove }) {
  const [picker, setPicker] = useState(false);
  return <View style={styles.editCard}>
    <View style={styles.editHeader}><Text style={styles.cardTitle}>{index+1}. {ex.name || 'Choisir un exercice'}</Text><Pressable onPress={remove}><Ionicons name="close" size={22} color={COLORS.red}/></Pressable></View>
    <Button onPress={()=>setPicker(true)} variant="ghost">{ex.name ? 'Changer exercice' : 'Sélectionner exercice'}</Button>
    <View style={styles.formGrid}>
      <Field label="Séries" value={ex.sets} onChangeText={v=>update(ex.id,{sets:v})}/><Field label="Répétitions" value={ex.reps} onChangeText={v=>update(ex.id,{reps:v})}/>
      <Field label="Poids estimé kg" value={ex.weight} onChangeText={v=>update(ex.id,{weight:v})}/><Field label="Tempo" value={ex.tempo} onChangeText={v=>update(ex.id,{tempo:v})}/>
      <Field label="Repos séries sec" value={ex.restSet} onChangeText={v=>update(ex.id,{restSet:v})}/><Field label="Repos exercices sec" value={ex.restExercise} onChangeText={v=>update(ex.id,{restExercise:v})}/>
    </View>
    <ExercisePicker visible={picker} onClose={()=>setPicker(false)} onPick={(pick)=>{update(ex.id,{name:pick.name, group:pick.group}); setPicker(false);}} />
  </View>;
}

function Field({ label, value, onChangeText }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={String(value)} onChangeText={onChangeText} style={styles.input} keyboardType="default" placeholderTextColor={COLORS.muted}/></View> }

function ExercisePicker({ visible, onClose, onPick }) {
  const [mode, setMode] = useState('poly');
  const [query, setQuery] = useState('');
  const groups = ['Pectoraux','Dos','Épaules','Biceps','Triceps','Quadriceps','Ischios','Fessiers','Mollets','Abdos','Mobilité'];
  const list = EXERCISES.filter(e => mode==='poly' ? e.group==='poly' : e.group===mode).filter(e=>e.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
  return <Modal visible={visible} animationType="slide"><SafeAreaView style={styles.safe}><View style={styles.container}>
    <Header title="Bibliothèque exercices" back onBack={onClose}/>
    <TextInput placeholder="Rechercher un exercice" placeholderTextColor={COLORS.muted} value={query} onChangeText={setQuery} style={styles.input}/>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50 }}><Chip active={mode==='poly'} onPress={()=>setMode('poly')}>Polyarticulaire A-Z</Chip>{groups.map(g=><Chip key={g} active={mode===g} onPress={()=>setMode(g)}>{g}</Chip>)}</ScrollView>
    <FlatList data={list} keyExtractor={i=>i.id} renderItem={({item})=><Pressable style={styles.exerciseRow} onPress={()=>onPick(item)}><Text style={styles.exerciseName}>{item.name}</Text><Text style={styles.muted}>{item.group==='poly'?'Polyarticulaire':item.group}</Text></Pressable>} />
  </View></SafeAreaView></Modal>;
}

function Chip({ children, active, onPress }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && {color:'#fff'}]}>{children}</Text></Pressable> }

function StartSession({ nav }) {
  return <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 36 }}><Header title="Démarrer" back onBack={()=>nav.setScreen('home')} />
    <Text style={styles.sectionTitle}>Choisis une séance</Text>
    {nav.sessions.map(s=><SessionCard key={s.id} session={s} onStart={()=>{nav.setSelectedSession(s); Alert.alert('Échauffement', 'Souhaites-tu t’échauffer avant la séance ?', [{text:'Non', onPress:()=>nav.setScreen('workout')}, {text:'Oui', onPress:()=>nav.setScreen('workout')}])}} onDelete={()=>{}} />)}
    {nav.sessions.length===0 && <Text style={styles.empty}>Crée d’abord une séance.</Text>}
  </ScrollView>;
}

function Workout({ nav }) {
  const session = nav.selectedSession || nav.sessions[0];
  const [warmup, setWarmup] = useState(true);
  const [warmSec, setWarmSec] = useState(0);
  const [started, setStarted] = useState(false);
  const [mainSec, setMainSec] = useState(0);
  const [exIdx, setExIdx] = useState(0);
  const [realRows, setRealRows] = useState([]);
  const [restSec, setRestSec] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const blink = useRef(new Animated.Value(0)).current;
  const current = session?.exercises[exIdx];

  useEffect(()=>{ const t=setInterval(()=>{ if(warmup&&!started) setWarmSec(s=>s+1); if(started) setMainSec(s=>s+1); if(restRunning) setRestSec(s=>s+1); },1000); return()=>clearInterval(t); },[warmup, started, restRunning]);
  useEffect(()=>{ if(restSec >= n(current?.restSet, 90) && restRunning) Animated.loop(Animated.sequence([Animated.timing(blink,{toValue:1,duration:350,useNativeDriver:false}),Animated.timing(blink,{toValue:0,duration:350,useNativeDriver:false})])).start(); },[restSec, restRunning, current]);
  useEffect(()=>{ if(current) setRealRows(Array.from({length:n(current.sets,1)}, (_,i)=>({set:i+1,reps:'',weight:''}))); },[exIdx]);
  if (!session) return <View style={styles.container}><Header title="Séance" back onBack={()=>nav.setScreen('home')} /><Text style={styles.empty}>Aucune séance sélectionnée.</Text></View>;

  const startWorkout = () => { setWarmup(false); setStarted(true); };
  const updateRow = (i, patch) => setRealRows(realRows.map((r,idx)=>idx===i?{...r,...patch}:r));
  const finishExercise = (endAll=false) => {
    const completed = realRows.every(r=>r.reps!=='' && r.weight!=='');
    if (!completed) return Alert.alert('Séries incomplètes', 'Remplis les répétitions et le poids réellement pris.');
    if (endAll || exIdx >= session.exercises.length-1) endWorkout(); else { setExIdx(exIdx+1); setRestRunning(false); setRestSec(0); }
  };
  const endWorkout = () => {
    const estimated = estimateSession(session.exercises);
    const realTonnage = session.exercises.reduce((acc,e,i)=> acc + (i===exIdx ? realRows.reduce((a,r)=>a+n(r.reps)*n(r.weight),0) : n(e.sets)*n(e.reps)*n(e.weight)),0);
    const real = { tonnage: Math.round(realTonnage), calories: Math.round(mainSec/60*7 + realTonnage*0.006), minutes: Math.round(mainSec/60) };
    nav.setHistory([...nav.history, { id: uid(), sessionId: session.id, name: session.name, date: new Date().toISOString(), estimated, real }]);
    nav.setSelectedSession({ ...session, lastSummary: { estimated, real }});
    nav.setScreen('stats');
  };
  if (warmup && !started) return <View style={styles.container}><Header title="Échauffement" back onBack={()=>nav.setScreen('home')} /><View style={styles.timerCircle}><Text style={styles.bigTimer}>{mmss(warmSec)}</Text><Text style={styles.muted}>Temps d’échauffement</Text></View><Button onPress={startWorkout}>Commencer la séance</Button><Button variant="ghost" onPress={()=>{setWarmup(false); setStarted(true)}}>Passer l’échauffement</Button></View>;

  const restLimit = n(current.restSet, 90);
  const restColor = restSec >= restLimit ? blink.interpolate({ inputRange:[0,1], outputRange:[COLORS.card2, COLORS.red]}) : COLORS.card2;
  return <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}><Header title={session.name} back onBack={()=>nav.setScreen('home')} />
    <Text style={styles.mainTimer}>⏱ {mmss(mainSec)}</Text>
    <View style={styles.editCard}><Text style={styles.cardTitle}>{exIdx+1}/{session.exercises.length} — {current.name}</Text><Text style={styles.muted}>Tempo {current.tempo} • Repos cible {current.restSet}s</Text>
      {realRows.map((r,i)=><View key={i} style={styles.setRow}><Text style={styles.setText}>Série {i+1}</Text><Text style={styles.setText}>{current.reps} reps • {current.weight} kg</Text><TextInput style={styles.miniInput} placeholder="reps" placeholderTextColor={COLORS.muted} value={r.reps} onChangeText={v=>updateRow(i,{reps:v})}/><TextInput style={styles.miniInput} placeholder="kg" placeholderTextColor={COLORS.muted} value={r.weight} onChangeText={v=>updateRow(i,{weight:v})}/></View>)}
      <Pressable onPress={()=>{setRestRunning(true); setRestSec(0);}}><Animated.View style={[styles.restBox, { backgroundColor: restColor }]}><Text style={styles.restText}>REPOS • {mmss(restSec)} / {mmss(restLimit)}</Text></Animated.View></Pressable>
    </View>
    <View style={styles.row}><Button variant="danger" style={{flex:1}} onPress={()=>finishExercise(true)}>Fini</Button><Button style={{flex:1}} onPress={()=>finishExercise(false)}>{exIdx >= session.exercises.length-1 ? 'Finir' : 'Suivant'}</Button></View>
  </ScrollView>;
}

function Stats({ nav }) {
  const last = nav.selectedSession?.lastSummary;
  const maxTon = Math.max(1, ...nav.history.map(h=>Math.max(h.estimated.tonnage,h.real.tonnage)));
  const maxCal = Math.max(1, ...nav.history.map(h=>Math.max(h.estimated.calories,h.real.calories)));
  const applyProgress = (type) => {
    const s = nav.selectedSession;
    if (!s) return nav.setScreen('home');
    const updated = nav.sessions.map(x => x.id===s.id ? { ...x, exercises: x.exercises.map(e => ({ ...e, reps: type==='rep'?String(n(e.reps)+1):e.reps, weight: type==='kg'?String(n(e.weight)+1):e.weight })) } : x);
    nav.setSessions(updated); nav.setSelectedSession(null); nav.setScreen('home');
  };
  return <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}><Header title="Stats" back onBack={()=>nav.setScreen('home')} />
    {last && <View style={styles.summary}><Text style={styles.sectionTitle}>Fin de séance</Text><View style={styles.compare}><View><Text style={styles.muted}>Estimé</Text><Text style={styles.big}>{last.estimated.calories} kcal</Text><Text style={styles.big}>{last.estimated.tonnage} kg</Text><Text style={styles.big}>{last.estimated.minutes} min</Text></View><View><Text style={styles.muted}>Réalisé</Text><Text style={styles.bigGreen}>{last.real.calories} kcal</Text><Text style={styles.bigGreen}>{last.real.tonnage} kg</Text><Text style={styles.bigGreen}>{last.real.minutes} min</Text></View></View><Text style={styles.sectionTitle}>Progression prochaine séance</Text><View style={styles.row}><Button style={{flex:1}} onPress={()=>applyProgress('rep')}>+1 rep</Button><Button style={{flex:1}} onPress={()=>applyProgress('kg')}>+1 kilo</Button></View></View>}
    <Text style={styles.sectionTitle}>Progression calories</Text><Graph data={nav.history.map(h=>({a:h.estimated.calories,b:h.real.calories,label:h.name.slice(0,5)}))} max={maxCal} />
    <Text style={styles.sectionTitle}>Progression tonnage</Text><Graph data={nav.history.map(h=>({a:h.estimated.tonnage,b:h.real.tonnage,label:h.name.slice(0,5)}))} max={maxTon} />
    {nav.history.length===0 && <Text style={styles.empty}>Aucune séance réalisée pour l’instant.</Text>}
  </ScrollView>;
}

function Graph({ data, max }) {
  return <ScrollView horizontal style={styles.graph} contentContainerStyle={{ alignItems:'flex-end', padding: 12 }}>
    {data.slice(-12).map((d,i)=><View key={i} style={styles.barGroup}><View style={[styles.bar, {height: Math.max(8, d.a/max*130), backgroundColor: COLORS.violet2}]} /><View style={[styles.bar, {height: Math.max(8, d.b/max*130), backgroundColor: COLORS.green}]} /><Text style={styles.barLabel}>{d.label}</Text></View>)}
  </ScrollView>
}

const styles = StyleSheet.create({
  safe:{flex:1, backgroundColor:COLORS.bg}, container:{flex:1, backgroundColor:COLORS.bg, padding:16},
  header:{flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:18}, headerTitle:{color:COLORS.text,fontWeight:'800',fontSize:20}, iconBtn:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  logoWrap:{width:74,height:74,borderRadius:20,borderWidth:2,borderColor:COLORS.violet,alignItems:'center',justifyContent:'center',backgroundColor:'#0D0D16'}, brand:{fontSize:44,fontWeight:'900',color:COLORS.text,letterSpacing:2,marginTop:12}, tagline:{color:COLORS.muted,letterSpacing:3,fontWeight:'700'}, hero:{alignItems:'center',padding:22,borderRadius:24,borderWidth:1,borderColor:COLORS.border,backgroundColor:COLORS.card,marginBottom:16}, heroText:{color:COLORS.text,textAlign:'center',marginTop:16,fontSize:16},
  row:{flexDirection:'row',gap:10,marginVertical:10}, statCard:{flex:1,padding:14,borderRadius:16,backgroundColor:COLORS.card,borderWidth:1,borderColor:COLORS.border,alignItems:'center'}, statIcon:{fontSize:24}, statValue:{color:COLORS.text,fontSize:18,fontWeight:'900',marginTop:4}, statLabel:{color:COLORS.muted,fontSize:12},
  menuGrid:{gap:12}, menuCard:{padding:18,borderRadius:18,backgroundColor:COLORS.card,borderWidth:1,borderColor:COLORS.border}, menuTitle:{color:COLORS.text,fontSize:22,fontWeight:'900',marginTop:8}, muted:{color:COLORS.muted}, sectionTitle:{color:COLORS.text,fontSize:18,fontWeight:'900',marginTop:22,marginBottom:10}, empty:{color:COLORS.muted,textAlign:'center',marginVertical:20},
  sessionCard:{flexDirection:'row',alignItems:'center',gap:8,padding:14,borderRadius:16,backgroundColor:COLORS.card,borderWidth:1,borderColor:COLORS.border,marginBottom:10}, sessionTitle:{color:COLORS.text,fontWeight:'800',fontSize:16}, smallBtn:{width:40,height:40,borderRadius:12,backgroundColor:COLORS.violet,alignItems:'center',justifyContent:'center'},
  btn:{backgroundColor:COLORS.violet,padding:15,borderRadius:14,alignItems:'center',marginTop:12}, btnGhost:{backgroundColor:COLORS.card2,borderWidth:1,borderColor:COLORS.border}, btnDanger:{backgroundColor:COLORS.red}, btnText:{color:'#fff',fontWeight:'900'},
  label:{color:COLORS.muted,fontSize:12,marginBottom:6,marginTop:8}, input:{backgroundColor:COLORS.card2,borderWidth:1,borderColor:COLORS.border,borderRadius:12,color:COLORS.text,padding:12}, field:{flex:1,minWidth:'47%'}, formGrid:{flexDirection:'row',flexWrap:'wrap',gap:10}, estimateBox:{padding:14,borderRadius:16,backgroundColor:COLORS.card,borderWidth:1,borderColor:COLORS.violet,marginVertical:14}, estimateTitle:{color:COLORS.text,fontWeight:'800'}, estimateText:{color:COLORS.violet2,fontSize:16,fontWeight:'900',marginTop:6},
  editCard:{padding:14,borderRadius:18,backgroundColor:COLORS.card,borderWidth:1,borderColor:COLORS.border,marginBottom:12}, editHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, cardTitle:{color:COLORS.text,fontSize:17,fontWeight:'900'}, chip:{paddingHorizontal:14,paddingVertical:10,borderRadius:999,backgroundColor:COLORS.card2,marginRight:8,borderWidth:1,borderColor:COLORS.border}, chipActive:{backgroundColor:COLORS.violet}, chipText:{color:COLORS.muted,fontWeight:'800'}, exerciseRow:{padding:15,borderBottomWidth:1,borderBottomColor:COLORS.border}, exerciseName:{color:COLORS.text,fontWeight:'800',fontSize:16},
  timerCircle:{width:220,height:220,borderRadius:110,borderWidth:7,borderColor:COLORS.violet,alignSelf:'center',alignItems:'center',justifyContent:'center',marginVertical:45,backgroundColor:COLORS.card}, bigTimer:{color:COLORS.text,fontSize:46,fontWeight:'900'}, mainTimer:{color:COLORS.violet2,fontSize:28,fontWeight:'900',textAlign:'center',marginBottom:10}, setRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8,borderBottomWidth:1,borderBottomColor:COLORS.border}, setText:{color:COLORS.text,flex:1,fontSize:12}, miniInput:{width:64,padding:10,borderRadius:10,borderWidth:1,borderColor:COLORS.border,color:COLORS.text,backgroundColor:COLORS.card2}, restBox:{padding:16,borderRadius:14,alignItems:'center',marginTop:14,borderWidth:1,borderColor:COLORS.border}, restText:{color:COLORS.text,fontWeight:'900'},
  summary:{padding:14,borderRadius:18,backgroundColor:COLORS.card,borderWidth:1,borderColor:COLORS.border}, compare:{flexDirection:'row',justifyContent:'space-around'}, big:{color:COLORS.text,fontSize:18,fontWeight:'900',marginTop:6}, bigGreen:{color:COLORS.green,fontSize:18,fontWeight:'900',marginTop:6}, graph:{backgroundColor:COLORS.card,borderRadius:18,borderWidth:1,borderColor:COLORS.border,minHeight:180}, barGroup:{alignItems:'center',marginRight:12,flexDirection:'row',gap:3}, bar:{width:14,borderRadius:5}, barLabel:{color:COLORS.muted,fontSize:10,position:'absolute',bottom:-18,left:0}
});
