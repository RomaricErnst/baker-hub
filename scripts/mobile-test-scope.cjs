// Keep every journey; widen the viewport matrix only for shared layout changes.
const {execFileSync}=require('node:child_process');
const full=process.env.FULL_MATRIX==='true';
let widths=[390];
if(full)widths=[320,375,390,430];
else {
 let base=process.env.COMPARE_BASE;
 if(!base||/^0+$/.test(base))base='HEAD^';
 let files=[];
 try{files=execFileSync('git',['diff','--name-only',base,'HEAD'],{encoding:'utf8'}).trim().split('\n');}
 catch{widths=[320,390];}
 if(files.some(file=>file==='app/globals.css'||/app\/components\/(Header|BakeNavigator|BottomActions|ScheduleKeyTimings|BakeStartStatus|StarterFeedStatus)\.tsx$/.test(file)))widths=[320,390];
}
process.stdout.write(`widths=${JSON.stringify(widths)}\n`);
