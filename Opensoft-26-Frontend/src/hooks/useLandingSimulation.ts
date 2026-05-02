import { useState, useEffect } from 'react';

const gbmTick = (p: number, mu=0.0001, sigma=0.0008, dt=0.1) => {
  let u=0, v=0;
  while(u===0) u=Math.random();
  while(v===0) v=Math.random();
  const z = Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
  return p * Math.exp((mu - sigma*sigma/2)*dt + sigma*Math.sqrt(dt)*z);
};

export const useLandingSimulation = () => {
  const [stats, setStats] = useState({
    btcPrice: 43250,
    orders: 0,
    spread: "2.50",
    ops: 80,
    latency: "0.4ms"
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        btcPrice: gbmTick(prev.btcPrice),
        orders: prev.orders + Math.floor(Math.random()*12)+6,
        spread: (Math.random()*4+1.5).toFixed(2),
        ops: Math.floor(Math.random()*30)+65,
        latency: (Math.random()*0.3+0.2).toFixed(1)+'ms'
      }));
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return stats;
};