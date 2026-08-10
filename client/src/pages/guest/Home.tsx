import { useEffect } from 'react';
import { useLiveStore } from '../../stores/liveStore';
import { useChannelsStore } from '../../stores/channelsStore';
import { useContentStore } from '../../stores/contentStore';
import Navbar from '../../components/landing/Navbar';
import Hero from '../../components/landing/Hero';
import LiveNow from '../../components/landing/LiveNow';
import About from '../../components/landing/About';
import Services from '../../components/landing/Services';
import MediaSection from '../../components/landing/MediaSection';
import Footer from '../../components/landing/Footer';

export default function Home() {
  const connect = useLiveStore((s) => s.connect);
  const loadChannels = useChannelsStore((s) => s.load);
  const loadContent = useContentStore((s) => s.load);

  useEffect(() => {
    connect();
    loadChannels();
    loadContent();
  }, [connect, loadChannels, loadContent]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0718]">
      <Navbar />
      <main>
        <Hero />
        <LiveNow />
        <About />
        <Services />
        <MediaSection />
      </main>
      <Footer />
    </div>
  );
}