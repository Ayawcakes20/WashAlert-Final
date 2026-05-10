package com.washalert.washalertbackend.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();

        // Default 5-minute TTL for all caches
        manager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(5, TimeUnit.MINUTES)
                .maximumSize(500));

        // Pre-declare named caches (TTL is driven by the default spec above;
        // per-cache TTL requires individual CaffeineCache beans — kept simple here)
        manager.setCacheNames(java.util.List.of("dashboard-summary", "analytics-summary"));

        return manager;
    }
}
