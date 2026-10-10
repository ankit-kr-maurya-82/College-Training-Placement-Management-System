import React from 'react'

export function Notice({ error, children }) { return error ? <p className="notice error">{error}</p> : children ? <p className="notice">{children}</p> : null }

export function Busy({ label = 'Loading…' }) { return <div className="state" role="status">{label}</div> }

export function Empty({ children }) { return <div className="state">{children}</div> }
