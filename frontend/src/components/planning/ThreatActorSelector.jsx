import React, { useState, useEffect } from 'react';
import { Search, Users, Target, Loader2, ChevronRight, ExternalLink } from 'lucide-react';
import * as api from '../../api/client';

export default function ThreatActorSelector({ onSelectTechniques }) {
  const [threatActors, setThreatActors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActor, setSelectedActor] = useState(null);
  const [actorTechniques, setActorTechniques] = useState(null);
  const [loadingTechniques, setLoadingTechniques] = useState(false);

  useEffect(() => {
    loadThreatActors();
  }, []);

  async function loadThreatActors() {
    setLoading(true);
    try {
      const data = await api.getThreatActors();
      setThreatActors(data);
    } catch (err) {
      setError('Failed to load threat actors');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectActor(actor) {
    setSelectedActor(actor);
    setLoadingTechniques(true);
    try {
      const data = await api.getThreatActorTechniques(actor.id);
      setActorTechniques(data);
    } catch (err) {
      console.error('Failed to load actor techniques:', err);
    } finally {
      setLoadingTechniques(false);
    }
  }

  function handleUseTechniques() {
    if (actorTechniques && onSelectTechniques) {
      onSelectTechniques(actorTechniques.technique_ids);
    }
  }

  const filteredActors = threatActors.filter(actor => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return actor.name.toLowerCase().includes(query) ||
           (actor.aliases || []).some(a => a.toLowerCase().includes(query));
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-400">{error}</p>
        <button onClick={loadThreatActors} className="mt-2 text-sm text-purple-400">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search threat actors..."
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Actor List */}
        <div className="space-y-2 max-h-[400px] overflow-auto">
          {filteredActors.length === 0 ? (
            <p className="text-center py-4 text-gray-500">No threat actors found</p>
          ) : (
            filteredActors.map(actor => (
              <button
                key={actor.id}
                onClick={() => handleSelectActor(actor)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedActor?.id === actor.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{actor.name}</h4>
                      {actor.aliases && actor.aliases.length > 0 && (
                        <p className="text-xs text-gray-500">
                          {actor.aliases.slice(0, 2).join(', ')}
                          {actor.aliases.length > 2 && ` +${actor.aliases.length - 2}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
                      {actor.technique_count} techniques
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Actor Details */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          {selectedActor ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">{selectedActor.name}</h3>
                  {selectedActor.source_url && (
                    <a
                      href={selectedActor.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                {selectedActor.aliases && selectedActor.aliases.length > 0 && (
                  <p className="text-sm text-gray-400 mt-1">
                    Also known as: {selectedActor.aliases.join(', ')}
                  </p>
                )}
              </div>

              {selectedActor.description && (
                <p className="text-sm text-gray-300">{selectedActor.description}</p>
              )}

              {loadingTechniques ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                </div>
              ) : actorTechniques ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Associated Techniques</span>
                    <span className="text-sm font-medium text-purple-400">
                      {actorTechniques.technique_count} techniques
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 max-h-32 overflow-auto">
                    {actorTechniques.technique_ids.map(id => (
                      <span
                        key={id}
                        className="px-2 py-1 bg-gray-700 rounded text-xs font-mono text-gray-300"
                      >
                        {id}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={handleUseTechniques}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Target className="w-4 h-4" />
                    Use These Techniques
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Select a threat actor to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
