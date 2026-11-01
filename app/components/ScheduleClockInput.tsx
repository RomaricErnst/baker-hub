'use client';
import {formatClock} from '../utils/units';
import type {InputHTMLAttributes} from 'react';

/** Native date/time picker with a localized display and an ISO-local input value. */
export default function ScheduleClockInput({isFr,type,value,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'type'|'value'> & {isFr:boolean;type:'time'|'datetime-local';value:string}) {
 const at=new Date(type==='datetime-local'?value:`2000-01-01T${value}`);
 const text=Number.isFinite(+at)
  ? (type==='datetime-local'?at.toLocaleDateString(isFr?'fr-FR':'en-GB',{day:'numeric',month:'short'})+' · ':'')+formatClock(at,isFr?'fr':'en')
  : value;
 return <span className="bh-clock-input"><span aria-hidden="true">{text}</span><input {...props} type={type} value={value}/></span>;
}
