import React,{useState,useCallback,useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import SchedulePicker from '../../app/components/SchedulePicker';
import {buildSchedule} from '../../app/utils';
const w=window as any;
function Harness({sc}:{sc:any}){
 const [start,setStart]=useState(sc.start),[blocks,setBlocks]=useState<any[]>([]);
 const [overrides,setOverrides]=useState({});
 const schedule=useMemo(()=>buildSchedule(start,sc.eat,blocks,sc.temp,45,'hand',sc.style),[start,blocks,sc]);
 const change=useCallback((s:Date,e:Date,b:any[],o:any)=>{setStart(s);setBlocks(b);if(o?.timingOverrides)setOverrides(o.timingOverrides);w.__h.rec.start=s.toISOString();w.__h.rec.blocks=b.map(x=>x.label);},[]);
 const validity=useCallback((v:boolean)=>{w.__h.rec.scheduleValid=v;},[]);
 return <SchedulePicker startTime={start} eatTime={sc.eat} blocks={blocks} preheatMin={45} styleKey={sc.style} kitchenTemp={sc.temp} bakeType="pizza" mode="custom" prefermentType="poolish" schedule={schedule} mixerType="hand" numItems={4} onChange={change} timingOverrides={overrides} fridgeTemp={6} flourStrength={1} onScheduleValidityChange={validity}/>;
}
w.__mount=(el:HTMLElement,sc:any)=>{w.__h={rec:{}};const root=createRoot(el);root.render(<Harness sc={sc}/>);return root;};
