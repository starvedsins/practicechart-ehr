import {describe,it,expect,beforeAll}from 'vitest';
import {generateKeyPairSync}from 'node:crypto';
import {encryptBundle,decryptBundle}from '../scripts/recovery-lib';
let publicKey:string,privateKey:string;
beforeAll(()=>{({publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}}));});
describe('authenticated recovery envelope failure paths',()=>{
 it('decrypts exact original bytes',()=>{const b=Buffer.from('Fictional database dump and files.');expect(decryptBundle(encryptBundle(b,publicKey),privateKey)).toEqual(b);});
 it('rejects modified ciphertext before restore',()=>{const b=encryptBundle(Buffer.from('Sample'),publicKey);b[b.length-1]^=1;expect(()=>decryptBundle(b,privateKey)).toThrow();});
 it('rejects unknown backup formats',()=>expect(()=>decryptBundle(Buffer.from('invalid backup'),privateKey)).toThrow());
 it('requires the matching recovery key',()=>{const other=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});expect(()=>decryptBundle(encryptBundle(Buffer.from('Sample'),publicKey),other.privateKey)).toThrow();});
});
