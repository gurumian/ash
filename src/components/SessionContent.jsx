import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SecondarySidebarContainer } from './SecondarySidebarContainer';
import { AIChatSidebar } from './AIChatSidebar';
import { IperfClientSidebar } from './IperfClientSidebar';
import { NetcatSidebar } from './NetcatSidebar';
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
    resizeTerminal, // Function to resize terminal, needed by SessionContent
    iperfLongTermData
}) => {
    const {
        id: sessionId,
        aiSidebarVisible,
        iperfSidebarVisible,
        netcatSidebarVisible,
        aiChatSidebarWidth = 400,
        iperfClientSidebarWidth = 500,
        netcatSidebarWidth = 500,
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
        // Returns needed for input persistence
        input,
        setInput,
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

    // Handlers for Sidebar
    const handleTabChange = (tab) => {
        onUpdateSession(sessionId, { activeSecondaryTab: tab });
        if (tab === 'ai-chat' && !aiSidebarVisible) {
            onUpdateSession(sessionId, { aiSidebarVisible: true });
        } else if (tab === 'iperf-client' && !iperfSidebarVisible) {
            onUpdateSession(sessionId, { iperfSidebarVisible: true });
        } else if (tab === 'netcat' && !netcatSidebarVisible) {
            onUpdateSession(sessionId, { netcatSidebarVisible: true });
        }
    };

    const handleCloseAIChat = () => {
        onUpdateSession(sessionId, { aiSidebarVisible: false });
        if (iperfSidebarVisible) {
            onUpdateSession(sessionId, { activeSecondaryTab: 'iperf-client' });
        } else if (netcatSidebarVisible) {
            onUpdateSession(sessionId, { activeSecondaryTab: 'netcat' });
        }
    };

    const handleCloseIperfClient = () => {
        onUpdateSession(sessionId, { iperfSidebarVisible: false });
        if (aiSidebarVisible) {
            onUpdateSession(sessionId, { activeSecondaryTab: 'ai-chat' });
        } else if (netcatSidebarVisible) {
            onUpdateSession(sessionId, { activeSecondaryTab: 'netcat' });
        }
    };

    const handleCloseNetcat = () => {
        onUpdateSession(sessionId, { netcatSidebarVisible: false });
        if (aiSidebarVisible) {
            onUpdateSession(sessionId, { activeSecondaryTab: 'ai-chat' });
        } else if (iperfSidebarVisible) {
            onUpdateSession(sessionId, { activeSecondaryTab: 'iperf-client' });
        }
    };

    const handleClose = () => {
        onUpdateSession(sessionId, { aiSidebarVisible: false, iperfSidebarVisible: false, netcatSidebarVisible: false });
        // NOTE: we do NOT clear AI messages on close to preserve history
        // if (clearAIMessages) clearAIMessages(); 
    };

    // Resize logic
    const handleResize = (newWidth) => {
        if (aiSidebarVisible) onUpdateSession(sessionId, { aiChatSidebarWidth: newWidth });
        if (iperfSidebarVisible) onUpdateSession(sessionId, { iperfClientSidebarWidth: newWidth });
        if (netcatSidebarVisible) onUpdateSession(sessionId, { netcatSidebarWidth: newWidth });
        // Trigger terminal resize
        if (isActive) {
            requestAnimationFrame(() => resizeTerminal && resizeTerminal());
        }
    };

    // Find the portal target for this session
    const portalTarget = document.getElementById(`sidebar-slot-${sessionId}`);
    const anySidebarVisible = aiSidebarVisible || iperfSidebarVisible || netcatSidebarVisible;
    const visibleSidebarWidths = [];
    if (aiSidebarVisible) visibleSidebarWidths.push(aiChatSidebarWidth);
    if (iperfSidebarVisible) visibleSidebarWidths.push(iperfClientSidebarWidth);
    if (netcatSidebarVisible) visibleSidebarWidths.push(netcatSidebarWidth);
    const sidebarWidth = visibleSidebarWidths.length ? Math.max(...visibleSidebarWidths) : 0;

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

            {/* Sidebar - Rendered via Portal to App.jsx global container */}
            {portalTarget && anySidebarVisible && createPortal(
                <div style={{ height: '100%', width: '100%', display: 'flex' }}>
                    {/* Resize Handle - Now inside the portal to be next to sidebar */}
                    <div
                        className="resize-handle"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startWidth = sidebarWidth || 400;

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

                    <SecondarySidebarContainer
                        width={sidebarWidth}
                        showAIChat={aiSidebarVisible}
                        showIperfClient={iperfSidebarVisible}
                        showNetcat={netcatSidebarVisible}
                        activeTab={activeSecondaryTab}
                        onTabChange={handleTabChange}
                        onClose={handleClose}
                        onCloseAIChat={handleCloseAIChat}
                        onCloseIperfClient={handleCloseIperfClient}
                        onCloseNetcat={handleCloseNetcat}
                    >
                        <AIChatSidebar
                            isVisible={aiSidebarVisible && ((iperfSidebarVisible || netcatSidebarVisible) ? activeSecondaryTab === 'ai-chat' : true)}
                            width={aiChatSidebarWidth}
                            messages={aiMessages}
                            // Props from useAICommand
                            isProcessing={isAIProcessing}
                            streamingToolResult={streamingToolResult}
                            processingConversations={processingConversations}
                            backendStatus={backendStatus}
                            terminal={terminalInstance}
                            onExecuteAICommand={executeAICommand}
                            onStopAICommand={stopAICommand}
                            conversations={conversations || []}
                            activeConversationId={activeConversationId}
                            onSwitchConversation={switchConversation}
                            onCreateNewConversation={createNewConversation}
                            onDeleteConversation={deleteConversation}
                            onUpdateConversationTitle={updateConversationTitle}
                            onClose={() => {
                                const nextTab = iperfSidebarVisible ? 'iperf-client' : (netcatSidebarVisible ? 'netcat' : null);
                                const updates = { aiSidebarVisible: false };
                                if (nextTab) updates.activeSecondaryTab = nextTab;
                                onUpdateSession(sessionId, updates);
                                // We do not clear messages here anymore, handled by session persistence
                            }}
                            showHeader={!iperfSidebarVisible && !netcatSidebarVisible}
                            pendingUserRequest={pendingUserRequest}
                            onRespondToRequest={handleAskUserResponse}
                            // Input persistence props
                            inputValue={input}
                            onInputChange={setInput}
                        />

                        <IperfClientSidebar
                            isVisible={iperfSidebarVisible && ((aiSidebarVisible || netcatSidebarVisible) ? activeSecondaryTab === 'iperf-client' : true)}
                            width={iperfClientSidebarWidth}
                            activeSession={session}
                            output={iperfClientOutput || ''}
                            onClearOutput={() => onUpdateSession(sessionId, { iperfClientOutput: '' })}
                            onStartTest={() => onUpdateSession(sessionId, { iperfClientOutput: '' })}
                            onClose={() => {
                                const nextTab = aiSidebarVisible ? 'ai-chat' : (netcatSidebarVisible ? 'netcat' : null);
                                const updates = { iperfSidebarVisible: false };
                                if (nextTab) updates.activeSecondaryTab = nextTab;
                                onUpdateSession(sessionId, updates);
                            }}
                            showHeader={!aiSidebarVisible && !netcatSidebarVisible}
                            longTermData={iperfLongTermData}
                        />

                        <NetcatSidebar
                            isVisible={netcatSidebarVisible && ((aiSidebarVisible || iperfSidebarVisible) ? activeSecondaryTab === 'netcat' : true)}
                            width={netcatSidebarWidth}
                            activeSession={session}
                            onClose={() => {
                                const nextTab = aiSidebarVisible ? 'ai-chat' : (iperfSidebarVisible ? 'iperf-client' : null);
                                const updates = { netcatSidebarVisible: false };
                                if (nextTab) updates.activeSecondaryTab = nextTab;
                                onUpdateSession(sessionId, updates);
                            }}
                            showHeader={!aiSidebarVisible && !iperfSidebarVisible}
                        />
                    </SecondarySidebarContainer>
                </div>,
                portalTarget
            )}
        </div>
    );
};
