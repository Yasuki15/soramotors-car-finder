// Configuration file for Car Finder Application
const CONFIG = {
    // Supabase Configuration
    SUPABASE: {
        URL: 'https://xzbrhvgqdsqydmxuyjbg.supabase.co',
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6YnJodmdxZHNxeWRteHV5amJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1MDY0NzYsImV4cCI6MjA2OTA4MjQ3Nn0.rQjz1Gcx295olkigYoZxWdqqb0EHDl0VYmlNFKCBGpM'
    },
    
    // App Configuration
    APP: {
        NAME: 'Car Finder',
        VERSION: '1.0.0',
        CONTACT_PHONE: '+6140856355'
    },
    
    // Database Configuration
    DATABASE: {
        CARS_TABLE: 'cars',
        MATCH_THRESHOLD: 0.75 // 75% match threshold
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

