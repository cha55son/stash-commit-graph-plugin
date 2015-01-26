package com.plugin.commitgraph.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.*;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

import com.atlassian.soy.renderer.SoyTemplateRenderer;
import com.atlassian.stash.exception.AuthorisationException;
import com.atlassian.stash.repository.Repository;
import com.atlassian.stash.repository.RepositoryService;
import com.atlassian.stash.server.ApplicationPropertiesService;
import com.atlassian.stash.user.Permission;
import com.atlassian.stash.user.PermissionValidationService;
import com.atlassian.stash.user.SecurityService;
import com.google.common.collect.ImmutableMap;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.regex.Pattern;

public class RepositorySettingsServlet extends HttpServlet {

    /**
     * 
     */
    private static final long serialVersionUID = 1L;

    private static final Logger log = LoggerFactory.getLogger(RepositorySettingsServlet.class);

    private final ApplicationPropertiesService propertiesService;

    private final SettingsManager settingsManager;

    private final PermissionValidationService validationService;

    private final RepositoryService repositoryService;

    private final SecurityService securityService;

    private final SoyTemplateRenderer soyTemplateRenderer;

    public RepositorySettingsServlet(
        ApplicationPropertiesService propertiesService,
        SettingsManager settingsManager,
        PermissionValidationService validationService,
        RepositoryService repositoryService,
        SecurityService securityService,
        SoyTemplateRenderer soyTemplateRenderer) {
        this.propertiesService = propertiesService;
        this.settingsManager = settingsManager;
        this.validationService = validationService;
        this.repositoryService = repositoryService;
        this.securityService = securityService;
        this.soyTemplateRenderer = soyTemplateRenderer;
    }

    // Make sure the current user is authenticated
    private boolean verifyLoggedIn(HttpServletRequest req, HttpServletResponse resp)
        throws IOException {
        try {
            validationService.validateAuthenticated();
        } catch (AuthorisationException notLoggedInException) {
            try {
                resp.sendRedirect(propertiesService.getLoginUri(URI.create(req.getRequestURL() +
                    (req.getQueryString() == null ? "" : "?" + req.getQueryString())
                    )).toASCIIString());
            } catch (Exception e) {
                log.error("Unable to redirect unauthenticated user to login page", e);
            }
            return false;
        }
        return true;
    }

    // Make sure the current user is a repo admin
    private boolean verifyRepoAdmin(HttpServletRequest req, HttpServletResponse resp,
        Repository repository) throws IOException {
        try {
            validationService.validateForRepository(repository, Permission.REPO_ADMIN);
        } catch (AuthorisationException notRepoAdminException) {
            resp.sendError(HttpServletResponse.SC_UNAUTHORIZED, "You do not have permission to access this page.");
            return false;
        }
        return true;
    }

    private void renderPage(HttpServletRequest req, HttpServletResponse resp,
        Repository repository, RepositorySettings repositorySettings,
        Collection<? extends Object> errors) throws ServletException, IOException {
        resp.setContentType("text/html");
        try {
            ImmutableMap<String, Object> data = new ImmutableMap.Builder<String, Object>()
                .put("repository", repository)
                .put("settings", repositorySettings)
                .put("errors", errors)
                .build();
            soyTemplateRenderer.render(resp.getWriter(),
                "com.plugin.commitgraph.commitgraph:network-soy",
                "plugin.commitgraph.repositorySettingsPage",
                data);
        } catch (Exception e) {
            log.error("Error rendering Soy template", e);
        }
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {
        if (!verifyLoggedIn(req, resp)) {
            return;
        }
        Repository repository = getRepository(req);
        if (repository == null) {
            resp.sendError(HttpServletResponse.SC_NOT_FOUND, "Repo not found.");
            return;
        }
        if (verifyRepoAdmin(req, resp, repository)) {
            renderPage(req, resp, repository, settingsManager.getRepositorySettings(repository),
                Collections.emptyList());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {
        if (!verifyLoggedIn(req, resp)) {
            return;
        }
        final Repository repository = getRepository(req);
        if (repository == null) {
            resp.sendError(HttpServletResponse.SC_NOT_FOUND, "Repo not found.");
            return;
        }
        if (!verifyRepoAdmin(req, resp, repository)) {
            return;
        }

        RepositorySettings s = settingsManager.getRepositorySettings(repository);

        // Parse arguments
        ArrayList<String> errors = new ArrayList<String>();

        boolean useRegex = "on".equals(req.getParameter("useRegex"));
        boolean useGravatar = "on".equals(req.getParameter("useGravatar"));
        boolean createLinks = "on".equals(req.getParameter("createLinks"));

        String refRegex = req.getParameter("refRegex");

        if(refRegex == null)
            refRegex = s.getRefRegex();

        try {
            Pattern.compile(refRegex);
        } catch (Exception e) {
            errors.add("Invalid regex: \"" + refRegex + "\"");
        }

        String refRegexReplace = req.getParameter("refRegexReplace");

        if(refRegexReplace == null)
            refRegexReplace = s.getRefRegexReplace();

        if (refRegexReplace.isEmpty()) {
           errors.add("Regex replace text can not be empty");
        }

        // Update settings object iff no parse errors
        RepositorySettings settings;
        if (errors.isEmpty()) {
            settings = settingsManager.setRepositorySettings(repository, useRegex, refRegex, refRegexReplace,
                    useGravatar, createLinks);
        } else {
            settings = settingsManager.getRepositorySettings(repository);
        }

        renderPage(req, resp, repository, settings, errors);
    }

    private Repository getRepository(HttpServletRequest req) {
        String uri = req.getRequestURI();
        String[] uriParts = uri.split("/");
        if (uriParts.length < 2) {
            return null;
        }
        return repositoryService.getBySlug(
            uriParts[uriParts.length - 2], uriParts[uriParts.length - 1]);
    }

}