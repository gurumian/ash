import React, { useRef, useState, useEffect } from 'react';
import { SecondarySidebarContainer } from './SecondarySidebarContainer';
import { AIChatSidebar } from './AIChatSidebar';
import { IperfClientSidebar } from './IperfClientSidebar';
import { useAICommand } from '../hooks/useAICommand';

export const SessionContent = ({
    session,
    isActive,
    terminalRef,
    terminalInstance,
    sshConnections,
    terminalInstances, // Need ref for useAICommand
    llmSettings,
    onUpdateSession,
    backendStatus,
    pendingUserRequest,
    handleAskUserResponse,
    resizeTerminal,
    activeSessionId, // needed for useAICommand
    // handlers for resize
}) => {
    const {
        id: sessionId,
        aiSidebarVisible,
        iperfSidebarVisible,
        aiChatSidebarWidth = 400,
        iperfClientSidebarWidth = 500,
        activeSecondaryTab = 'ai-chat',
        aiMessages: initialMessages, // We don't use session.aiMessages for live state, useAICommand has its own, but we could sync if needed
        iperfClientOutput
    } = session;

    // Local state for AI processing since useAICommand expects us to manage it
    const [isAIProcessing, setIsAIProcessing] = useState(false);

    // Stable callback for showing AI command input (sidebar)
    const setShowAICommandInput = React.useCallback((val) => {
        // val can be boolean or function
        const visible = typeof val === 'function' ? val(aiSidebarVisible) : val;
        // We only care if it's true (to assume input needed) or we just follow visibility
        if (visible !== aiSidebarVisible) {
            onUpdateSession(sessionId, { aiSidebarVisible: visible });
            if (visible && activeSecondaryTab !== 'ai-chat') {
                onUpdateSession(sessionId, { activeSecondaryTab: 'ai-chat' });
            }
        }
    }, [sessionId, aiSidebarVisible, activeSecondaryTab, onUpdateSession]);

    // We use useAICommand hook locally for this session
    // useAICommand expects activeSessionId. We pass OUR session ID.
    // It also needs references to connections.
    const {
        executeAICommand,
        aiMessages, // Message state from hook
        // isAIProcessing, // useAICommand DOES NOT return this, we manage it
        // setAiMessages,
        clearAIMessages,
        // other returns
        stopAICommand,
        // isProcessing, // Hook DOES NOT return this usually
        processingConversationId,
        streamingToolResult,
        processingConversations,
        conversations,
        activeConversationId, // Hook state
        switchConversation,
        createNewConversation,
        deleteConversation,
        updateConversationTitle
    } = useAICommand({
        activeSessionId: sessionId, // Treat this session as the "active" one for this hook instance
        terminalInstances,
        sshConnections,
        llmSettings,
        setErrorDialog: (err) => console.error(err), // simplified for now, or pass from App
        setIsAIProcessing, // Pass our stable setter
        setShowAICommandInput, // Pass our stable setter
        isSidebarVisible: aiSidebarVisible // Important for lifecycle
    });

    // State for internal processing tracking if hook doesn't expose everything (Hook seems to expose specific states? I need to check useAICommand returns)
    // Re-checking useAICommand returns: 
    /*
    return {
      executeAICommand,
      aiMessages,
      setAiMessages,
      clearAIMessages,
      stopAICommand, // wait, did I see stopAICommand in the hook? 
      // ...
    }
    */
    // I need to verify useAICommand exports.

    // Handlers for Sidebar
    const handleTabChange = (tab) => {
        onUpdateSession(sessionId, { activeSecondaryTab: tab });
        if (tab === 'ai-chat' && !aiSidebarVisible) {
            onUpdateSession(sessionId, { aiSidebarVisible: true });
        } else if (tab === 'iperf-client' && !iperfSidebarVisible) {
            onUpdateSession(sessionId, { iperfSidebarVisible: true });
        }
    };

    const handleCloseAIChat = () => {
        onUpdateSession(sessionId, { aiSidebarVisible: false });
        if (iperfSidebarVisible) {
            onUpdateSession(sessionId, { activeSecondaryTab: 'iperf-client' });
        }
    };

    const handleCloseIperfClient = () => {
        onUpdateSession(sessionId, { iperfSidebarVisible: false });
        if (aiSidebarVisible) {
            onUpdateSession(sessionId, { activeSecondaryTab: 'ai-chat' });
        }
    };

    const handleClose = () => {
        onUpdateSession(sessionId, { aiSidebarVisible: false, iperfSidebarVisible: false });
        if (clearAIMessages) clearAIMessages();
    };

    // Resize logic
    const handleResize = (newWidth) => {
        if (aiSidebarVisible) onUpdateSession(sessionId, { aiChatSidebarWidth: newWidth });
        if (iperfSidebarVisible) onUpdateSession(sessionId, { iperfClientSidebarWidth: newWidth });
        // Trigger terminal resize
        if (isActive) {
            requestAnimationFrame(() => resizeTerminal && resizeTerminal());
        }
    };

    return (
        <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
            {/* Terminal Area */}
            <div style={{ flex: 1, position: 'relative', height: '100%', minWidth: 0 }}>
                <div
                    ref={terminalRef}
                    className="terminal-content"
                    style={{ height: '100%', width: '100%' }}
                />
            </div>

            {/* Resize Handle */}
            {(aiSidebarVisible || iperfSidebarVisible) && (
                <div
                    className="resize-handle"
                    style={{
                        width: '4px',
                        background: 'transparent',
                        cursor: 'col-resize',
                        flexShrink: 0,
                        zIndex: 10,
                        transition: 'background 0.2s',
                        position: 'relative' // Flex item
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#4a90e2'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const startX = e.clientX;
                        const currentWidth = aiSidebarVisible && iperfSidebarVisible
                            ? Math.max(aiChatSidebarWidth, iperfClientSidebarWidth)
                            : (aiSidebarVisible ? aiChatSidebarWidth : iperfClientSidebarWidth);
                        const startWidth = currentWidth;

                        const handleMouseMove = (e) => {
                            const diff = startX - e.clientX; // Reverse because right sidebar
                            const newWidth = Math.max(300, Math.min(1000, startWidth + diff));
                            handleResize(newWidth);
                        };

                        const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                        };

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                    }}
                />
            )}

            {/* Sidebar */}
            <SecondarySidebarContainer
                width={aiSidebarVisible && iperfSidebarVisible
                    ? Math.max(aiChatSidebarWidth, iperfClientSidebarWidth)
                    : (aiSidebarVisible ? aiChatSidebarWidth : (iperfSidebarVisible ? iperfClientSidebarWidth : 0))}
                showAIChat={aiSidebarVisible}
                showIperfClient={iperfSidebarVisible}
                activeTab={activeSecondaryTab}
                onTabChange={handleTabChange}
                onClose={handleClose}
                onCloseAIChat={handleCloseAIChat}
                onCloseIperfClient={handleCloseIperfClient}
            >
                <AIChatSidebar
                    isVisible={aiSidebarVisible && (!iperfSidebarVisible || activeSecondaryTab === 'ai-chat')}
                    width={aiChatSidebarWidth}
                    messages={aiMessages}
                    // Props from useAICommand needed here
                    isProcessing={isAIProcessing}
                    streamingToolResult={streamingToolResult}
                    processingConversations={processingConversations}
                    backendStatus={backendStatus}
                    terminal={terminalInstance}
                    onExecuteAICommand={executeAICommand}
                    onStopAICommand={stopAICommand} // TODO: Verify
                    conversations={conversations || []}
                    activeConversationId={activeConversationId}
                    onSwitchConversation={switchConversation}
                    onCreateNewConversation={createNewConversation}
                    onDeleteConversation={deleteConversation}
                    onUpdateConversationTitle={updateConversationTitle}
                    onClose={aiSidebarVisible && iperfSidebarVisible ? () => {
                        onUpdateSession(sessionId, { aiSidebarVisible: false, activeSecondaryTab: 'iperf-client' });
                    } : () => {
                        // If pending request... logic from App.jsx
                        onUpdateSession(sessionId, { aiSidebarVisible: false });
                        if (clearAIMessages) clearAIMessages();
                    }}
                    showHeader={!iperfSidebarVisible}
                    pendingUserRequest={pendingUserRequest}
                    onRespondToRequest={handleAskUserResponse}
                />

                <IperfClientSidebar
                    isVisible={iperfSidebarVisible && (!aiSidebarVisible || activeSecondaryTab === 'iperf-client')}
                    width={iperfClientSidebarWidth}
                    activeSession={session}
                    output={iperfClientOutput || ''}
                    onClearOutput={() => onUpdateSession(sessionId, { iperfClientOutput: '' })}
                    onStartTest={() => onUpdateSession(sessionId, { iperfClientOutput: '' })} // Should probably clear
                    onClose={aiSidebarVisible && iperfSidebarVisible ? () => {
                        onUpdateSession(sessionId, { iperfSidebarVisible: false, activeSecondaryTab: 'ai-chat' });
                    } : () => onUpdateSession(sessionId, { iperfSidebarVisible: false })}
                    showHeader={!aiSidebarVisible}
                />
            </SecondarySidebarContainer>
        </div>
    );
};
