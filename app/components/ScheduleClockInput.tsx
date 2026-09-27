'use client';
import type {InputHTMLAttributes} from 'react';

/** Native date/time picker with a consistent, readable 24-hour face. */
export default function ScheduleClockInput({isFr,type,value,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'type'|'value'> & {isFr:boolean;type:'time'|'datetime-local';value:string}) {
 const at=type==='datetime-local'?new Date(value):null;
 const text=at&&Number.isFinite(+at)
  ? at.toLocaleString(isFr?'fr-FR':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})
  : value;
 return <span className="bh-clock-input"><span aria-hidden="true">{text}</span><input {...props} type={type} value={value}/></span>;
}
