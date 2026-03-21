import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Globe, Lock, Radio, Users, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import StarBackground from "../components/StarBackground";
import FloatingNav from "../components/FloatingNav";
import CreateCommunityModal from "../components/CreateCommunityModal";

// ─── Community card ───────────────────────────────────────────────────────────
function CommunityCard({ community, onJoin, onOpen, joining }) {
  const isOwner = community.isOwner;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.07] rounded-2xl overflow-hidden hover:border-white/[0.14] transition-all group"
    >
      {/* Banner / avatar row */}
      <div className="relative h-16 bg-gradient-to-br from-purple-900/40 to-indigo-900/30 flex-shrink-0">
        {community.coverImage && (
          <img src={community.coverImage} className="w-full h-full object-cover" alt="" />
        )}
        <div className="absolute -bottom-5 left-4">
          {community.avatar ? (
            <img src={community.avatar} className="w-10 h-10 rounded-xl border-2 border-zinc-900 object-cover" alt="" />
          ) : (
            <div className="w-10 h-10 rounded-xl border-2 border-zinc-900 bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {community.name?.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {/* Badges top-right */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {community.broadcastOnly && (
            <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-amber-400">
              <Radio size={9} /> Broadcast
            </span>
          )}
          <span className={`flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${community.isPublic ? "text-emerald-400" : "text-zinc-400"}`}>
            {community.isPublic ? <><Globe size={9} /> Public</> : <><Lock size={9} /> Private</>}
          </span>
        </div>
      </div>

      <div className="pt-7 px-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{community.name}</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
              <Users size={10} /> {community.memberCount ?? community.members?.length ?? 0} members
              {isOwner && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[9px] font-bold uppercase">Owner</span>}
            </p>
            {community.description && (
              <p className="text-[11px] text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">{community.description}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onOpen(community)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-semibold transition-all"
          >
            Open <ChevronRight size={13} />
          </button>

          {!community.isMember && !isOwner && community.isPublic && (
            <button
              onClick={() => onJoin(community._id)}
              disabled={joining === community._id}
              className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-purple-900/30"
            >
              {joining === community._id
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                : "Join"
              }
            </button>
          )}

          {community.isMember && !isOwner && (
            <span className="flex-1 py-2 text-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
              ✓ Joined
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── CommunitiesPage ──────────────────────────────────────────────────────────
export default function CommunitiesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab,           setTab]           = useState("explore"); // "explore" | "mine"
  const [search,        setSearch]        = useState("");
  const [exploring,     setExploring]     = useState([]);
  const [mine,          setMine]          = useState([]);
  const [loadingEx,     setLoadingEx]     = useState(true);
  const [loadingMine,   setLoadingMine]   = useState(true);
  const [joining,       setJoining]       = useState(null);
  const [showCreate,    setShowCreate]    = useState(false);

  const searchTimer = useRef(null);

  // Fetch explorer communities
  const fetchExplore = useCallback(async (q = "") => {
    setLoadingEx(true);
    try {
      const res = await API.get(`/community?search=${encodeURIComponent(q)}`);
      setExploring(res.data.communities || []);
    } catch (err) { console.error(err); }
    finally { setLoadingEx(false); }
  }, []);

  // Fetch my communities
  const fetchMine = useCallback(async () => {
    setLoadingMine(true);
    try {
      const res = await API.get("/community/mine");
      setMine(res.data);
    } catch (err) { console.error(err); }
    finally { setLoadingMine(false); }
  }, []);

  useEffect(() => { fetchExplore(); fetchMine(); }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchExplore(search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const handleJoin = async (communityId) => {
    setJoining(communityId);
    try {
      await API.post(`/community/${communityId}/join`);
      // Refresh both lists
      fetchExplore(search);
      fetchMine();
    } catch (err) { console.error(err); }
    finally { setJoining(null); }
  };

  const handleOpen = (community) => {
    navigate(`/communities/${community._id}`);
  };

  const handleCreated = (newCommunity) => {
    setMine((prev) => [{ ...newCommunity, isOwner: true, memberCount: 1 }, ...prev]);
    setTab("mine");
  };

  const displayed = tab === "explore" ? exploring : mine;
  const loading   = tab === "explore" ? loadingEx  : loadingMine;

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white">
      <StarBackground />
      <FloatingNav />

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-24 pb-16">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white">Communities</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {tab === "explore"
                ? `Discovering public communities in ${user?.city || "your city"}`
                : "Communities you own or have joined"
              }
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-all shadow-lg shadow-purple-900/40"
          >
            <Plus size={16} /> New
          </motion.button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-2xl p-1 mb-6 w-fit">
          {[
            { id: "explore", label: "Explore" },
            { id: "mine",    label: "My Communities" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                tab === id
                  ? "bg-white text-zinc-950 shadow"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search — only on explore tab */}
        {tab === "explore" && (
          <div className="relative mb-6">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search communities in ${user?.city || "your city"}…`}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-all"
            />
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-4 text-zinc-600">
            <Globe size={48} className="text-zinc-800" />
            <p className="text-sm font-medium">
              {tab === "explore"
                ? search ? `No communities found for "${search}"` : `No public communities in ${user?.city || "your city"} yet`
                : "You haven't joined any communities yet"
              }
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all"
            >
              Create the first one
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((c) => (
              <CommunityCard
                key={c._id}
                community={c}
                onJoin={handleJoin}
                onOpen={handleOpen}
                joining={joining}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateCommunityModal
            onClose={() => setShowCreate(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}