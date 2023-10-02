import { expect } from 'chai';
import { load_userland } from './userland';
import fs from 'fs';

const stat_sync = fs.statSync;
const read_file_sync = fs.readFileSync;
const exists_sync = fs.existsSync;
const readdir_sync = fs.readdirSync;

describe('Userland', () => {
  beforeEach(() => {
    fs.statSync = () => ({
      isDirectory: () => false,
      isFile: () => true,
    });
    fs.existsSync = () => { };
    fs.readdirSync = () => { };
  });
  afterEach(() => {
    fs.statSync = stat_sync;
    fs.readFileSync = read_file_sync;
    fs.existsSync = exists_sync;
    fs.readdirSync = readdir_sync;
  });
  it('returns undefined for non-executable files', () => {
    fs.statSync = () => ({
      isDirectory: () => true,
      isFile: () => false,
    });
    expect(load_userland('foo')).to.eq(undefined);
  });
  it('executes files in the startup folder', () => {
    let called = false;
    fs.readFileSync = () => called = true;
    load_userland('test.js');
    expect(called).to.eq(true);
  });
  it('throws if unable to execute a startup file', () => {
    let called = 0;
    const error = console.error;
    console.error = () => called++;
    fs.readFileSync = () => { throw new Error('test'); };
    load_userland('test.js');
    expect(called).to.eq(2);
    console.error = error;
  });
});
