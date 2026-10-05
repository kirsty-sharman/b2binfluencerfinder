import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverPublicPages } from '../lib/public-pages.ts';
test('public routes follow additions and removals and exclude private and dynamic paths',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'public-pages-'));
 const add=file=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),'');};
 try {
  ['page.tsx','blog/page.tsx','blog/[slug]/page.tsx','app/page.tsx','sign-in/page.tsx','(marketing)/about/page.tsx','hidden/page.tsx','hidden/sitemap.exclude'].forEach(add);
  assert.deepEqual(discoverPublicPages(root),['/','/about','/blog']);
  add('pricing/page.tsx');assert.ok(discoverPublicPages(root).includes('/pricing'));
  fs.unlinkSync(path.join(root,'pricing/page.tsx'));assert.ok(!discoverPublicPages(root).includes('/pricing'));
 } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
