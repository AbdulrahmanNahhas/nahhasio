#!/usr/bin/env python3
"""Synthetic development fixtures only; never import a family catalog."""
from pathlib import Path
import hashlib, struct, zlib, sys
root=Path(sys.argv[1]).resolve()
(root/'artwork').mkdir(exist_ok=True)
def image(name,base):
 w,h=640,900; rows=[]
 for y in range(h):
  row=bytearray()
  for x in range(w):
   glow=max(0,1-((x-w*.6)**2+(y-h*.32)**2)**.5/430)
   orb=(x-w*.6)**2+(y-h*.32)**2<105**2
   ridge=y>h*.68+60*((x//80)%2)
   row.extend([min(255,int(c*(.3+.65*(1-y/h))+(100 if orb else 30)*glow)) if not ridge else int(c*.17) for c in base])
  rows.append(b'\0'+row)
 def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
 data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
 (root/'artwork'/name).write_bytes(data);return hashlib.sha256(data).hexdigest(),len(data)
salt='00112233445566778899aabbccddeeff'
hash=salt+':'+hashlib.scrypt(b'demo12345',salt=salt.encode(),n=16384,r=16,p=1,dklen=64,maxmem=128*1024*1024).hex()
sql=['BEGIN;','SET TRANSACTION READ WRITE;']
for n,(email,role,kind,label) in enumerate([('admin@demo.local','owner','admin','المشرف التجريبي'),('friend@demo.local','member','family','حساب الصديق')],1):
 uid=f'demo-user-{n}'; aid=f'97000000-0000-4000-8000-{n:012}'
 sql += [f"INSERT INTO auth_users(id,name,email,role) VALUES('{uid}','{label}','{email}','{role}');",f"INSERT INTO accounts(id,auth_user_id,kind,status,display_name,avatar_key,slug) VALUES('{aid}','{uid}','{kind}','active','{label}','anon-{n}.png','demo-{n}');",f"INSERT INTO auth_accounts(id,account_id,provider_id,user_id,password) VALUES('{uid}','{uid}','credential','{uid}','{hash}');",f"INSERT INTO account_content_policies(account_id,audience,age,sexuality_risk,behavioral_risk,theology_risk) VALUES('{aid}','adult','18+','high','high','high');"]
for n,(name,ar,summary,color) in enumerate([('Moon Journey','رحلة القمر','قصة تجريبية عن رحلة بين النجوم، لاختبار تصفح المكتبة وصفحة العمل.',(90,140,240)),('Forest Letters','رسائل الغابة','عمل تجريبي عن أصدقاء يكتشفون غابة قديمة. بيانات وصور مولدة محليًا للعرض فقط.',(50,190,125)),('Amber City','مدينة الكهرمان','مغامرة تجريبية في مدينة مضيئة. يمكنك تعديلها بحرية في هذه المكتبة المعزولة.',(240,140,60))],1):
 tid=f'97100000-0000-4000-8000-{n:012}';iid=f'97200000-0000-4000-8000-{n:012}';asset=f'97300000-0000-4000-8000-{n:012}';filename=f'poster-{n}.png';sha,size=image(filename,color)
 sql += [f"INSERT INTO titles(id,canonical_title,sort_title,title_ar,summary,release_year) VALUES('{tid}','{name}','{name}','{ar}','{summary}',2024);",f"INSERT INTO installments(id,title_id,kind,position,title,summary,status,release_date) VALUES('{iid}','{tid}','season',1,'الموسم الأول','موسم تجريبي من ثلاث حلقات.','completed','2024-01-01');",f"INSERT INTO media_assets(id,path,sha256,mime_type,byte_size,width,height,original_filename) VALUES('{asset}','/media/uploads/{filename}','{sha}','image/png',{size},640,900,'{filename}');",f"INSERT INTO media_asset_assignments(asset_id,role,title_id,is_primary) VALUES('{asset}','poster','{tid}',true),('{asset}','banner','{tid}',true);"]
 for e in range(1,4):sql.append(f"INSERT INTO episodes(installment_id,number,position,title,release_date,runtime_minutes) VALUES('{iid}',{e},{e},'الحلقة التجريبية {e}','2024-01-0{e}',24);")
sql += ["UPDATE server_instance SET id='97900000-0000-4000-8000-000000000001', name='مكتبة التطوير — بيانات تجريبية';",'COMMIT;']
(root/'seed.sql').write_text('\n'.join(sql)+'\n')
