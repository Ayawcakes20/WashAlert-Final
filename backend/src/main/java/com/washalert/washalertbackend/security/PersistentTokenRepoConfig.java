package com.washalert.washalertbackend.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.web.authentication.rememberme.PersistentTokenRepository;
import org.springframework.security.web.authentication.rememberme.PersistentRememberMeToken;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.util.Date;

@Configuration
public class PersistentTokenRepoConfig {

    @Bean
    public PersistentTokenRepository persistentTokenRepository(DataSource dataSource) {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        try {
            jdbc.execute("CREATE TABLE IF NOT EXISTS persistent_logins (" +
                    "username VARCHAR(64) NOT NULL, " +
                    "series VARCHAR(64) PRIMARY KEY, " +
                    "token VARCHAR(64) NOT NULL, " +
                    "last_used TIMESTAMP NOT NULL)");
        } catch (Exception ex) {
            // Log or ignore if the driver doesn't support IF NOT EXISTS, 
            // though MySQL and H2 both do.
        }

        return new PersistentTokenRepository() {
            @Override
            public void createNewToken(PersistentRememberMeToken token) {
                jdbc.update(
                        "INSERT INTO persistent_logins (username, series, token, last_used) VALUES (?, ?, ?, ?)",
                        token.getUsername(),
                        token.getSeries(),
                        token.getTokenValue(),
                        new Timestamp(token.getDate().getTime())
                );
            }

            @Override
            public void updateToken(String series, String tokenValue, Date lastUsed) {
                jdbc.update(
                        "UPDATE persistent_logins SET token = ?, last_used = ? WHERE series = ?",
                        tokenValue,
                        new Timestamp(lastUsed.getTime()),
                        series
                );
            }

            @Override
            public PersistentRememberMeToken getTokenForSeries(String seriesId) {
                var rows = jdbc.query(
                        "SELECT username, series, token, last_used FROM persistent_logins WHERE series = ?",
                        (rs, rowNum) -> new PersistentRememberMeToken(
                                rs.getString("username"),
                                rs.getString("series"),
                                rs.getString("token"),
                                rs.getTimestamp("last_used")
                        ),
                        seriesId
                );
                return rows.isEmpty() ? null : rows.get(0);
            }

            @Override
            public void removeUserTokens(String username) {
                jdbc.update("DELETE FROM persistent_logins WHERE username = ?", username);
            }
        };
    }
}
