import { useState } from 'react'
import { Card, Input } from '@/components/ui'
import { useConfigStore } from '@/stores/configStore'
import './GlobalSettings.css'

// Regex for AMS Net ID validation: IP-Adresse mit .1.1 am Ende (z.B. 127.0.0.1.1.1)
const AMS_NET_ID_REGEX = /^(\d{1,3}\.){3}\d{1,3}\.1\.1$/

function validateAmsNetId(value: string): string | undefined {
    if (!value) return undefined
    if (!AMS_NET_ID_REGEX.test(value)) {
        return 'Format: IP-Adresse.1.1 (z.B. 127.0.0.1.1.1)'
    }
    // Validate IP octets are 0-255
    const octets = value.split('.')
    for (let i = 0; i < 4; i++) {
        const num = parseInt(octets[i], 10)
        if (num < 0 || num > 255) {
            return 'IP-Oktetten müssen zwischen 0 und 255 sein'
        }
    }
    return undefined
}

export function GlobalSettings() {
    const { globalSettings, updateGlobalSettings } = useConfigStore()
    const [amsNetIdError, setAmsNetIdError] = useState<string | undefined>()
    const [mainServerError, setMainServerError] = useState<string | undefined>()

    const handleAmsNetIdChange = (value: string) => {
        updateGlobalSettings({ amsNetId: value })
        setAmsNetIdError(validateAmsNetId(value))
    }

    const handleMainServerChange = (value: string) => {
        updateGlobalSettings({ mainServer: value })
        setMainServerError(validateAmsNetId(value))
    }

    return (
        <Card title="Global Settings" className="global-settings">
            <div className="settings-grid">
                <Input
                    label="Project Name"
                    value={globalSettings.projectName}
                    onChange={(e) => updateGlobalSettings({ projectName: e.target.value })}
                    placeholder="Scope Project"
                />

                <Input
                    label="AMS Net ID"
                    value={globalSettings.amsNetId}
                    onChange={(e) => handleAmsNetIdChange(e.target.value)}
                    placeholder="127.0.0.1.1.1"
                    helpText="Target system AMS Net ID"
                    error={amsNetIdError}
                />

                <Input
                    label="Main Server"
                    value={globalSettings.mainServer}
                    onChange={(e) => handleMainServerChange(e.target.value)}
                    placeholder="127.0.0.1.1.1"
                    error={mainServerError}
                />

                <Input
                    label="Base Sample Time (100ns units)"
                    type="number"
                    value={globalSettings.baseSampleTime}
                    onChange={(e) =>
                        updateGlobalSettings({ baseSampleTime: parseInt(e.target.value, 10) || 0 })
                    }
                    helpText={`= ${(globalSettings.baseSampleTime / 10000).toFixed(2)} ms`}
                />
            </div>
        </Card>
    )
}
