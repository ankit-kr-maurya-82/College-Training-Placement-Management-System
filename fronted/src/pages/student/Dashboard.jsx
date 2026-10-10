import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useAuth } from '../../context/auth.js'
import { Busy, Empty, Notice } from '../../components/Feedback.jsx'
import DriveCard from '../../components/JobCard.jsx'
import Pagination from '../../components/Pagination.jsx'
import { companyName } from '../../utils/format.js'

export default function Drives() {
  const [params,setParams] = useSearchParams(); const [data,setData] = useState(null); const [busy,setBusy] = useState(true); const [error,setError] = useState(''); const [companies,setCompanies] = useState([])
  const filters = useMemo(()=>Object.fromEntries(['search','company','location','jobType','workMode','page'].map(k=>[k,params.get(k)||''])),[params])
  useEffect(()=>{api.get('/companies?limit=100').then(r=>setCompanies(r.companies||[])).catch(()=>{})},[])
  useEffect(()=>{let live=true;setBusy(true);setError('');api.get('/drives',{params:{...filters,page:filters.page||1,limit:9}}).then(r=>{if(live)setData(r)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setBusy(false)});return()=>{live=false}},[filters])
  function filter(k,v){const next=new URLSearchParams(params);if(v)next.set(k,v);else next.delete(k);if(k!=='page')next.delete('page');setParams(next)}
  return <><section className="hero"><div><p className="eyebrow">YOUR NEXT OPPORTUNITY</p><h1>Find a role that<br/><em>moves you forward.</em></h1><p>Explore current placement drives from trusted employers.</p><Link className="button" to={data?.drives?.[0]?`/drives/${data.drives[0]._id}`:'/drives'}>Explore opportunities <span>↗</span></Link></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-note">Build your future<br/><b>one application at a time.</b></div><div className="hero-number">01 <span>/ CAREER</span></div></div></section>
    <section className="section"><div className="section-heading"><div><p className="eyebrow">OPEN POSITIONS</p><h2>Latest opportunities</h2></div><span className="muted">{data?.pagination?.total ?? '—'} active drives</span></div>
      <div className="filters"><input aria-label="Search drives" placeholder="Search title, skills, location…" value={filters.search} onChange={e=>filter('search',e.target.value)}/><select aria-label="Company" value={filters.company} onChange={e=>filter('company',e.target.value)}><option value="">All companies</option>{companies.map(c=><option key={c._id} value={c._id}>{companyName(c)}</option>)}</select><input aria-label="Location" placeholder="Location" value={filters.location} onChange={e=>filter('location',e.target.value)}/><select aria-label="Job type" value={filters.jobType} onChange={e=>filter('jobType',e.target.value)}><option value="">All job types</option>{['Full-time','Internship','Part-time'].map(v=><option key={v}>{v}</option>)}</select><select aria-label="Work mode" value={filters.workMode} onChange={e=>filter('workMode',e.target.value)}><option value="">All work modes</option>{['On-site','Hybrid','Remote'].map(v=><option key={v}>{v}</option>)}</select></div>
      {error&&<Notice error={error}/>}{busy?<Busy/>:data?.drives?.length?<><div className="drive-grid">{data.drives.map(d=><DriveCard key={d._id} drive={d}/>)}</div><Pagination pagination={data.pagination} onPage={p=>filter('page',String(p))}/></>:<Empty>No active drives match those filters. Try a broader search.</Empty>}</section></>
}

export function Home(){const {user}=useAuth();const [summary,setSummary]=useState(null);useEffect(()=>{if(user)api.get('/applications/my',{params:{limit:5}}).then(setSummary).catch(()=>{})},[user]);return <>{user&&<section className="welcome-strip"><div><p className="eyebrow">YOUR PLACEMENT SPACE</p><h2>Welcome back, {user.name?.split(' ')[0]||'there'}.</h2><p>Keep moving toward the opportunity that fits you.</p></div><div className="welcome-stat"><b>{summary?.pagination?.total??'—'}</b><span>applications</span></div><Link className="button" to="/applications">Track applications</Link></section>}<Drives/></>}
