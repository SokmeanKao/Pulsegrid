package com.monitoring.backend.web;

import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.util.ResourceUtils;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

@Configuration
public class UiStaticConfig implements WebMvcConfigurer {

	@Value("${pulsegrid.ui.dir:file:/app/ui/}")
	private String uiDir;

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		Path root;
		try {
			root = ResourceUtils.getFile(uiDir).toPath().toAbsolutePath().normalize();
		} catch (Exception e) {
			return;
		}
		if (!Files.isDirectory(root)) {
			return;
		}

		String location = root.toUri().toString();
		if (!location.endsWith("/")) {
			location = location + "/";
		}

		registry.addResourceHandler("/**")
				.addResourceLocations(location)
				.resourceChain(true)
				.addResolver(new PathResourceResolver() {
					@Override
					protected Resource getResource(String resourcePath, Resource locationRes) throws java.io.IOException {
						Resource requested = locationRes.createRelative(resourcePath);
						if (requested.exists() && requested.isReadable()) {
							return requested;
						}
						Resource indexed = locationRes.createRelative(
								resourcePath.endsWith("/") ? resourcePath + "index.html" : resourcePath + "/index.html");
						if (indexed.exists() && indexed.isReadable()) {
							return indexed;
						}
						return new FileSystemResource(root.resolve("index.html"));
					}
				});
	}

	@Override
	public void addViewControllers(ViewControllerRegistry registry) {
		registry.addViewController("/").setViewName("forward:/index.html");
	}
}
