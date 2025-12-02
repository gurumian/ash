import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Terminal Search Bar component - Search functionality for terminal content
 */
export const TerminalSearchBar = memo(function TerminalSearchBar({
  terminal,
  searchAddon,
  isVisible,
  onClose
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const inputRef = useRef(null);
  const currentMatchRef = useRef(0);
  const { t } = useTranslation('common');

  // Focus input when search bar becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isVisible]);

  // Update search when term or options change
  useEffect(() => {
    if (!searchAddon || !terminal) return;

    const updateMatchInfo = () => {
    // xterm.js SearchAddon doesn't provide match count directly
    // We'll count matches in the terminal buffer
    if (!searchTerm || !terminal) {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    try {
      const buffer = terminal.buffer.active;
      let count = 0;
      
      // Build regex pattern
      let pattern;
      if (regex) {
        try {
          pattern = new RegExp(searchTerm, caseSensitive ? 'g' : 'gi');
        } catch (e) {
          // Invalid regex, skip counting
          setMatchCount(0);
          setCurrentMatch(0);
          return;
        }
      } else {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
      }

      // Count matches in buffer
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          const lineStr = line.translateToString(true);
          const matches = lineStr.match(pattern);
          if (matches) {
            count += matches.length;
          }
        }
      }

      setMatchCount(count);
      const initialMatch = count > 0 ? 1 : 0;
      setCurrentMatch(initialMatch);
      currentMatchRef.current = initialMatch;
    } catch (error) {
      console.error('Error updating match info:', error);
      setMatchCount(0);
      setCurrentMatch(0);
      currentMatchRef.current = 0;
    }
    };

    if (searchTerm) {
      const options = {
        caseSensitive,
        wholeWord,
        regex
      };
      
      searchAddon.findNext(searchTerm, options);
      updateMatchInfo();
    } else {
      searchAddon.clearDecorations();
      setMatchCount(0);
      setCurrentMatch(0);
      currentMatchRef.current = 0;
    }
  }, [searchTerm, caseSensitive, wholeWord, regex, searchAddon, terminal]);

  const handleFindNext = useCallback(() => {
    if (!searchAddon || !searchTerm || matchCount === 0) return;
    const options = {
      caseSensitive,
      wholeWord,
      regex
    };
    searchAddon.findNext(searchTerm, options);
    // Update current match index (circular: wrap to 1 if at end)
    setCurrentMatch(prev => {
      const next = prev >= matchCount ? 1 : prev + 1;
      currentMatchRef.current = next;
      return next;
    });
  }, [searchAddon, searchTerm, matchCount, caseSensitive, wholeWord, regex]);

  const handleFindPrevious = useCallback(() => {
    if (!searchAddon || !searchTerm || matchCount === 0) return;
    const options = {
      caseSensitive,
      wholeWord,
      regex
    };
    searchAddon.findPrevious(searchTerm, options);
    // Update current match index (circular: wrap to matchCount if at start)
    setCurrentMatch(prev => {
      const next = prev <= 1 ? matchCount : prev - 1;
      currentMatchRef.current = next;
      return next;
    });
  }, [searchAddon, searchTerm, matchCount, caseSensitive, wholeWord, regex]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handleFindPrevious();
      } else {
        handleFindNext();
      }
    } else if (e.key === 'F3') {
      e.preventDefault();
      if (e.shiftKey) {
        handleFindPrevious();
      } else {
        handleFindNext();
      }
    }
  };

  if (!isVisible) return null;

  return (
    <div className="terminal-search-bar">
      <div className="search-input-group">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={t('common:search')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="search-options">
          <button
            className={`search-option-btn ${caseSensitive ? 'active' : ''}`}
            onClick={() => setCaseSensitive(!caseSensitive)}
            title={t('common:matchCase')}
          >
            Aa
          </button>
          <button
            className={`search-option-btn ${wholeWord ? 'active' : ''}`}
            onClick={() => setWholeWord(!wholeWord)}
            title={t('common:matchWholeWord')}
          >
            W
          </button>
          <button
            className={`search-option-btn ${regex ? 'active' : ''}`}
            onClick={() => setRegex(!regex)}
            title={t('common:regularExpression')}
          >
            .*
          </button>
        </div>
        <div className="search-navigation">
          <button
            className="search-nav-btn"
            onClick={handleFindPrevious}
            disabled={!searchTerm}
            title={`${t('common:previous')} (Shift+Enter)`}
          >
            ↑
          </button>
          <button
            className="search-nav-btn"
            onClick={handleFindNext}
            disabled={!searchTerm}
            title={`${t('common:next')} (Enter)`}
          >
            ↓
          </button>
        </div>
        {searchTerm && matchCount > 0 && (
          <div className="search-match-info">
            {currentMatch} / {matchCount}
          </div>
        )}
        <button
          className="search-close-btn"
          onClick={onClose}
          title={`${t('common:close')} (Esc)`}
        >
          ×
        </button>
      </div>
    </div>
  );
});

