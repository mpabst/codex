import chai from 'chai'

declare global {
  interface Window {
    // TypeScript, or something, will shim Mocha's BDD globals for us, but we
    // need to do this 
    chai: typeof chai
  }
}
