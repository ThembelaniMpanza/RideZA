import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TABS = [
    { key: 'ride', label: 'Ride' },
    { key: 'history', label: 'History' },
    { key: 'profile', label: 'Profile' },
];

const HomeScreen = () => {
    const [activeTab, setActiveTab] = useState('ride');

    const renderContent = () => {
        switch (activeTab) {
            case 'ride':
                return <Text style={styles.contentText}>Ride Content</Text>;
            case 'history':
                return <Text style={styles.contentText}>History Content</Text>;
            case 'profile':
                return <Text style={styles.contentText}>Profile Content</Text>;
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.tabBar}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[
                            styles.tab,
                            activeTab === tab.key && styles.activeTab,
                        ]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Text style={[
                            styles.tabLabel,
                            activeTab === tab.key && styles.activeTabLabel,
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            <View style={styles.content}>
                {renderContent()}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    tabBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 12,
        backgroundColor: '#eee',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        elevation: 8, // for Android shadow
        shadowColor: '#000', // for iOS shadow
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    activeTab: { backgroundColor: '#007AFF' },
    tabLabel: { color: '#333', fontSize: 16 },
    activeTabLabel: { color: '#fff', fontWeight: 'bold' },
    content: {
         flex: 1, 
         alignItems: 'center',
          justifyContent: 'center',
           marginBottom: 64 },
    contentText: { fontSize: 20, color: '#333' },
});

export default HomeScreen;